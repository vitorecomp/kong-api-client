import { readdirSync, readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { PLUGINS, type PluginName } from '../../src/generated/plugins.js';

interface PluginCategoryEntry {
  category: string;
  title: string;
}

interface PluginCategoriesFile {
  plugins: Record<string, PluginCategoryEntry>;
}

interface PluginExampleEntry {
  scope: string;
  config: Record<string, unknown>;
}

interface PluginExamplesFile {
  plugins: Record<string, PluginExampleEntry>;
}

function readJson<T>(relativePath: string): T {
  const raw = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  return JSON.parse(raw) as T;
}

function slugifyCategory(category: string): string {
  return category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function listRecordedPlugins(): string[] {
  return readdirSync(new URL('../../schemas/kong-3.9/plugins/', import.meta.url))
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -'.json'.length))
    .sort();
}

function listMarkdownFilesRecursive(dirUrl: URL, prefix = ''): string[] {
  const entries = readdirSync(dirUrl, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...listMarkdownFilesRecursive(new URL(`${entry.name}/`, dirUrl), rel));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(rel);
    }
  }
  return files.sort();
}

function evalLiteralExpression(node: ts.Expression): unknown {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isNumericLiteral(node)) {
    return Number(node.text);
  }
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return -Number(node.operand.text);
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return null;
  }
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((elem) => evalLiteralExpression(elem));
  }
  if (ts.isObjectLiteralExpression(node)) {
    const out: Record<string, unknown> = {};
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) {
        throw new Error(`Expected property assignment in example object literal`);
      }
      const key =
        ts.isIdentifier(prop.name) ||
        ts.isStringLiteral(prop.name) ||
        ts.isNumericLiteral(prop.name)
          ? prop.name.text
          : null;
      if (key === null) {
        throw new Error(`Unsupported property name in example object literal`);
      }
      out[key] = evalLiteralExpression(prop.initializer);
    }
    return out;
  }
  throw new Error(`Unsupported expression kind in example literal: ${ts.SyntaxKind[node.kind]}`);
}

interface ParsedEnableExample {
  pluginName: string;
  options: Record<string, unknown>;
}

function extractEnableExample(markdown: string, pagePath: string): ParsedEnableExample {
  const match = /```ts\n([\s\S]*?)\n```/.exec(markdown);
  if (!match?.[1]) {
    throw new Error(`No TypeScript code block found in ${pagePath}`);
  }

  const sourceFile = ts.createSourceFile(
    `${pagePath}.ts`,
    match[1],
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  );

  let found: ParsedEnableExample | undefined;

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'enable' &&
      node.arguments.length === 2
    ) {
      const [nameArg, optionsArg] = node.arguments;
      if (nameArg && optionsArg) {
        const pluginName = evalLiteralExpression(nameArg);
        const options = evalLiteralExpression(optionsArg);
        if (
          typeof pluginName === 'string' &&
          options !== null &&
          typeof options === 'object' &&
          !Array.isArray(options)
        ) {
          found = { pluginName, options: options as Record<string, unknown> };
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  if (!found) {
    throw new Error(`Could not find kong.plugins.enable(...) call in ${pagePath}`);
  }
  return found;
}

describe('generated plugin reference pages contract', () => {
  const recordedPlugins = listRecordedPlugins();
  const categoriesFile = readJson<PluginCategoriesFile>('../../schemas/plugin-categories.json');
  const examplesFile = readJson<PluginExamplesFile>('../../schemas/plugin-examples.json');
  const docsPluginsDir = new URL('../../docs/plugins/', import.meta.url);
  const actualMarkdownFiles = listMarkdownFilesRecursive(docsPluginsDir);

  it('has a page for every recorded plugin and no page for any unrecorded plugin', () => {
    const expectedPages = recordedPlugins.map((name) => {
      const meta = categoriesFile.plugins[name];
      expect(meta, `missing category metadata for ${name}`).toBeDefined();
      return `${slugifyCategory(meta!.category)}/${name}.md`;
    });

    const expectedAllFiles = ['index.md', ...expectedPages].sort();
    expect(actualMarkdownFiles).toEqual(expectedAllFiles);
  });

  it('links every plugin page from docs/plugins/index.md', () => {
    const indexMd = readFileSync(new URL('index.md', docsPluginsDir), 'utf8');
    expect(indexMd.startsWith('---\ntitle: Plugins\n---\n')).toBe(true);

    for (const name of recordedPlugins) {
      const meta = categoriesFile.plugins[name]!;
      const relLink = `./${slugifyCategory(meta.category)}/${name}.md`;
      expect(indexMd, `docs/plugins/index.md should link ${relLink}`).toContain(
        `[${meta.title}](${relLink})`,
      );
    }
  });

  it('embeds front matter, metadata, Kong docs link, and exact example config on every plugin page', () => {
    for (const name of recordedPlugins as PluginName[]) {
      const meta = categoriesFile.plugins[name]!;
      const example = examplesFile.plugins[name]!;
      const info = PLUGINS[name];
      const relPath = `${slugifyCategory(meta.category)}/${name}.md`;
      const md = readFileSync(new URL(relPath, docsPluginsDir), 'utf8');

      // Front matter with title
      expect(md.startsWith('---\n')).toBe(true);
      expect(md).toContain(`title: ${meta.title}\n`);

      // Required page metadata
      expect(md).toContain(`**Category:** ${meta.category}`);
      expect(md).toContain(`https://developer.konghq.com/plugins/${name}/`);
      for (const target of info.targets) {
        expect(md).toContain(`\`${target}\``);
      }
      for (const scope of info.scopes) {
        expect(md).toContain(`\`${scope}\``);
      }
      for (const protocol of info.protocols) {
        expect(md).toContain(`\`${protocol}\``);
      }
      expect(md).toContain('| Field');

      // Example call matches schemas/plugin-examples.json exactly
      const parsed = extractEnableExample(md, relPath);
      expect(parsed.pluginName).toBe(name);
      expect(parsed.options.config).toEqual(example.config);

      const isGlobalOnly = info.scopes.length === 1 && info.scopes[0] === 'global';
      if (isGlobalOnly) {
        expect(parsed.options.on).toBeUndefined();
      } else {
        expect(parsed.options.on).toEqual({ route: 'my-route' });
      }
    }
  });
});
