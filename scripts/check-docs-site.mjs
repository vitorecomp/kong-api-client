#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir, hostname, userInfo } from 'node:os';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const EXPECTED_SOURCE_PREFIX = 'https://github.com/vitorecomp/kong-api-client/blob/master/';

function listFilesRecursive(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results.sort();
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

function stripScriptAndStyle(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
}

function extractAnchors(content) {
  const anchors = new Set();
  const idRegex = /\bid\s*=\s*(?:"([^"]+)"|'([^']+)')/gi;
  let match;
  while ((match = idRegex.exec(content)) !== null) {
    const raw = match[1] ?? match[2];
    if (raw) {
      anchors.add(decodeHtmlEntities(raw));
    }
  }
  const anchorNameRegex = /<a\b[^>]*\bname\s*=\s*(?:"([^"]+)"|'([^']+)')/gi;
  while ((match = anchorNameRegex.exec(content)) !== null) {
    const raw = match[1] ?? match[2];
    if (raw) {
      anchors.add(decodeHtmlEntities(raw));
    }
  }
  return anchors;
}

function extractLinks(html) {
  const cleaned = stripScriptAndStyle(html);
  const links = [];
  const attrRegex = /\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  let match;
  while ((match = attrRegex.exec(cleaned)) !== null) {
    const raw = match[1] ?? match[2] ?? '';
    links.push(decodeHtmlEntities(raw));
  }
  return links;
}

function isExternalUrl(url) {
  return /^(?:https?:|mailto:|tel:|javascript:|data:|\/\/)/i.test(url);
}

function safeDecodeUriComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function decodeTypeDocBundle(jsText) {
  const match = /=\s*"([A-Za-z0-9+/=]+)"/.exec(jsText);
  if (!match?.[1]) {
    return null;
  }
  try {
    return inflateSync(Buffer.from(match[1], 'base64')).toString('utf8');
  } catch {
    return null;
  }
}

function collectNavEntries(nodes, out = []) {
  for (const node of nodes) {
    if (typeof node.path === 'string' && typeof node.text === 'string') {
      out.push({ text: node.text, path: node.path });
    }
    if (Array.isArray(node.children)) {
      collectNavEntries(node.children, out);
    }
  }
  return out;
}

function buildLeakPatterns() {
  const patterns = [];
  const addLiteral = (label, value) => {
    if (!value || value.length < 3) {
      return;
    }
    patterns.push({ label, needle: value });
  };

  addLiteral('file:// URL', 'file://');
  addLiteral('repository path', REPO_ROOT);
  addLiteral('home directory', homedir());

  const host = hostname();
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    addLiteral('host name', host);
  }

  try {
    const username = userInfo().username;
    if (
      username &&
      username.length >= 4 &&
      !['root', 'user', 'node', 'runner'].includes(username)
    ) {
      addLiteral('user name', username);
    }
  } catch {
    // Ignore environments without a passwd entry.
  }

  return patterns;
}

function checkDocsSite(siteDir = resolve(REPO_ROOT, 'docs-site')) {
  const errors = [];

  if (!existsSync(siteDir) || !statSync(siteDir).isDirectory()) {
    return {
      ok: false,
      errors: [`Documentation output directory does not exist: ${relative(REPO_ROOT, siteDir)}`],
      stats: { htmlFiles: 0, checkedLinks: 0, pluginPages: 0 },
    };
  }

  for (const required of ['index.html', '.nojekyll']) {
    if (!existsSync(resolve(siteDir, required))) {
      errors.push(`Missing required file in docs-site/: ${required}`);
    }
  }

  const allFiles = listFilesRecursive(siteDir);
  const htmlFiles = allFiles.filter((file) => extname(file) === '.html');
  const svgFiles = allFiles.filter((file) => extname(file) === '.svg');

  // Index anchors for every HTML and SVG file in docs-site/.
  const htmlContents = new Map();
  const anchorsByFile = new Map();

  for (const file of htmlFiles) {
    const content = readFileSync(file, 'utf8');
    htmlContents.set(file, content);
    anchorsByFile.set(file, extractAnchors(content));
  }
  for (const file of svgFiles) {
    const content = readFileSync(file, 'utf8');
    anchorsByFile.set(file, extractAnchors(content));
  }

  // 1. Validate every local link and anchor across all HTML files.
  let checkedLinks = 0;
  for (const file of htmlFiles) {
    const relSource = relative(siteDir, file);
    const html = htmlContents.get(file);
    const links = extractLinks(html);

    for (const rawLink of links) {
      if (rawLink === '' || rawLink === '#') {
        continue;
      }

      if (rawLink.startsWith('https://github.com/vitorecomp/kong-api-client/blob/')) {
        if (!rawLink.startsWith(EXPECTED_SOURCE_PREFIX)) {
          errors.push(`${relSource}: source link does not use fixed master template: ${rawLink}`);
        }
        continue;
      }

      if (isExternalUrl(rawLink)) {
        continue;
      }

      checkedLinks += 1;
      const hashIndex = rawLink.indexOf('#');
      const beforeHash = hashIndex === -1 ? rawLink : rawLink.slice(0, hashIndex);
      const rawFragment = hashIndex === -1 ? '' : rawLink.slice(hashIndex + 1);
      const queryIndex = beforeHash.indexOf('?');
      const rawPath = queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex);
      const decodedPath = safeDecodeUriComponent(rawPath);

      let targetFile;
      if (decodedPath === '') {
        targetFile = file;
      } else if (decodedPath.startsWith('/')) {
        targetFile = resolve(siteDir, decodedPath.slice(1));
      } else {
        targetFile = resolve(dirname(file), decodedPath);
      }

      const relToSite = relative(siteDir, targetFile);
      if (relToSite.startsWith('..') || relToSite === '..') {
        errors.push(`${relSource}: link escapes docs-site/: ${rawLink}`);
        continue;
      }

      if (existsSync(targetFile) && statSync(targetFile).isDirectory()) {
        targetFile = resolve(targetFile, 'index.html');
      }

      if (!existsSync(targetFile)) {
        errors.push(`${relSource}: broken local link '${rawLink}' (target not found)`);
        continue;
      }

      if (rawFragment.length > 0) {
        const anchors = anchorsByFile.get(targetFile);
        const decodedFragment = safeDecodeUriComponent(rawFragment);
        if (!anchors || (!anchors.has(rawFragment) && !anchors.has(decodedFragment))) {
          errors.push(
            `${relSource}: broken anchor '${rawLink}' (id '${decodedFragment}' not found in ${relative(siteDir, targetFile)})`,
          );
        }
      }
    }
  }

  // 2. Verify all 45 plugin pages are present in the built site and navigation.
  const categoriesDoc = JSON.parse(
    readFileSync(resolve(REPO_ROOT, 'schemas/plugin-categories.json'), 'utf8'),
  );
  const plugins = Object.entries(categoriesDoc.plugins);
  let foundPluginPages = 0;

  const navJsPath = resolve(siteDir, 'assets/navigation.js');
  const navEntriesByTitle = new Map();
  const pluginNavByCategory = new Map();
  if (existsSync(navJsPath)) {
    const decodedNav = decodeTypeDocBundle(readFileSync(navJsPath, 'utf8'));
    if (decodedNav) {
      const navTree = JSON.parse(decodedNav);
      for (const entry of collectNavEntries(navTree)) {
        navEntriesByTitle.set(entry.text, entry.path);
      }
      const pluginsGroup = navTree.find((node) => node.text === 'Plugins');
      if (!pluginsGroup || !Array.isArray(pluginsGroup.children)) {
        errors.push("Missing 'Plugins' group in site navigation");
      } else {
        for (const catNode of pluginsGroup.children) {
          if (typeof catNode.text === 'string' && Array.isArray(catNode.children)) {
            const titles = new Set(
              catNode.children
                .filter((child) => typeof child.text === 'string')
                .map((child) => child.text),
            );
            pluginNavByCategory.set(catNode.text, titles);
          }
        }
      }
    } else {
      errors.push('Could not decode assets/navigation.js');
    }
  } else {
    errors.push('Missing assets/navigation.js in docs-site/');
  }

  const documentHtmlFiles = htmlFiles.filter((file) =>
    relative(siteDir, file).startsWith('documents/'),
  );

  for (const [pluginName, meta] of plugins) {
    const expectedKongUrl = `https://developer.konghq.com/plugins/${pluginName}/`;
    const navPath = navEntriesByTitle.get(meta.title);

    let matchedFile = null;
    if (navPath) {
      const candidate = resolve(siteDir, navPath);
      const html = htmlContents.get(candidate);
      if (html && html.includes(expectedKongUrl)) {
        matchedFile = candidate;
      }
    }

    if (!matchedFile) {
      for (const candidate of documentHtmlFiles) {
        const html = htmlContents.get(candidate);
        if (html && html.includes(expectedKongUrl)) {
          matchedFile = candidate;
          break;
        }
      }
    }

    if (!matchedFile) {
      errors.push(`Missing rendered plugin page for '${pluginName}' (${meta.title})`);
    } else {
      foundPluginPages += 1;
      if (!navPath) {
        errors.push(`Plugin page '${pluginName}' (${meta.title}) is missing from site navigation`);
      } else {
        const categoryTitles = pluginNavByCategory.get(meta.category);
        if (!categoryTitles || !categoryTitles.has(meta.title)) {
          errors.push(
            `Plugin page '${pluginName}' (${meta.title}) is not grouped under Plugins > ${meta.category} in site navigation`,
          );
        }
      }
    }
  }

  // 3. Check for leaked local paths, user name, or host name anywhere under docs-site/.
  const leakPatterns = buildLeakPatterns();
  const textExtensions = new Set(['.html', '.js', '.css', '.xml', '.json', '.svg']);
  for (const file of allFiles) {
    if (!textExtensions.has(extname(file))) {
      continue;
    }
    const relPath = relative(siteDir, file);
    const raw = readFileSync(file, 'utf8');
    const blobs = [{ label: relPath, text: raw }];

    if (extname(file) === '.js' && relPath.startsWith('assets/')) {
      const inflated = decodeTypeDocBundle(raw);
      if (inflated) {
        blobs.push({ label: `${relPath} (inflated)`, text: inflated });
      }
    }

    for (const blob of blobs) {
      for (const { label, needle } of leakPatterns) {
        if (blob.text.includes(needle)) {
          errors.push(`${blob.label}: contains leaked ${label}`);
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    stats: {
      htmlFiles: htmlFiles.length,
      checkedLinks,
      pluginPages: foundPluginPages,
      expectedPluginPages: plugins.length,
    },
  };
}

function main() {
  const customDir = process.argv[2];
  const siteDir = customDir ? resolve(customDir) : resolve(REPO_ROOT, 'docs-site');
  const result = checkDocsSite(siteDir);

  if (!result.ok) {
    console.error(`Documentation site check failed (${result.errors.length} error(s)):`);
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `Documentation site check passed (${result.stats.htmlFiles} HTML files, ${result.stats.checkedLinks} local links/anchors, ${result.stats.pluginPages}/${result.stats.expectedPluginPages} plugin pages).`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

export { checkDocsSite };
