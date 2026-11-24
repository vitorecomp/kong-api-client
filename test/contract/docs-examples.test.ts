import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TEST_DIR, '../..');
const ENTRY_FILE = resolve(REPO_ROOT, 'src/index.ts');

interface ExtractedBlock {
  sourceFile: string;
  blockIndex: number;
  startLine: number;
  code: string;
  skipped: boolean;
}

function collectMarkdownFiles(): string[] {
  const docsDir = resolve(REPO_ROOT, 'docs');
  const guideFiles = readdirSync(docsDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith('.md') &&
        // docs/endpoints.md is generated and its calls are type-checked via test/support/endpoint-calls.ts.
        entry.name !== 'endpoints.md',
    )
    .map((entry) => `docs/${entry.name}`)
    .sort();
  return ['README.md', ...guideFiles];
}

function extractTypeScriptBlocks(relativePath: string): ExtractedBlock[] {
  const raw = readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');
  const lines = raw.split(/\r?\n/);
  const blocks: ExtractedBlock[] = [];

  let inFence = false;
  let isTsFence = false;
  let skipped = false;
  let startLine = 0;
  let blockIndex = 0;
  let buffer: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (!inFence) {
      const openMatch = /^```([^\s`]*)(.*)$/.exec(line);
      if (openMatch) {
        const lang = (openMatch[1] ?? '').toLowerCase();
        const meta = (openMatch[2] ?? '').trim();
        inFence = true;
        isTsFence = lang === 'ts' || lang === 'typescript';
        skipped = /\bno-check\b/.test(meta);
        startLine = i + 2;
        buffer = [];
      }
      continue;
    }

    if (/^```\s*$/.test(line)) {
      if (isTsFence) {
        blockIndex += 1;
        blocks.push({
          sourceFile: relativePath,
          blockIndex,
          startLine,
          code: buffer.join('\n'),
          skipped,
        });
      }
      inFence = false;
      isTsFence = false;
      skipped = false;
      buffer = [];
      continue;
    }

    if (isTsFence) {
      buffer.push(line);
    }
  }

  return blocks;
}

function loadRepoCompilerOptions(): ts.CompilerOptions {
  const configPath = resolve(REPO_ROOT, 'tsconfig.json');
  const readResult = ts.readConfigFile(configPath, (path) => ts.sys.readFile(path));
  if (readResult.error) {
    throw new Error(ts.flattenDiagnosticMessageText(readResult.error.messageText, '\n'));
  }
  const parsed = ts.parseJsonConfigFileContent(readResult.config, ts.sys, REPO_ROOT);
  if (parsed.errors.length > 0) {
    const msg = parsed.errors
      .map((err) => ts.flattenDiagnosticMessageText(err.messageText, '\n'))
      .join('\n');
    throw new Error(msg);
  }
  return {
    ...parsed.options,
    noEmit: true,
    baseUrl: REPO_ROOT,
    paths: {
      'kong-api-client': ['./src/index.ts'],
    },
  };
}

function normalizeVirtualCode(code: string): string {
  const hasModuleSyntax = /^\s*(?:import|export)\b/m.test(code);
  return hasModuleSyntax ? `${code}\n` : `${code}\nexport {};\n`;
}

function compileBlocks(blocks: ExtractedBlock[]): string[] {
  const options = loadRepoCompilerOptions();
  const baseHost = ts.createCompilerHost(options);
  const virtualFiles = new Map<string, { block: ExtractedBlock; text: string }>();

  for (const block of blocks) {
    const safeName = block.sourceFile.replace(/[^a-zA-Z0-9._-]/g, '_');
    const virtualPath = resolve(
      REPO_ROOT,
      `__docs_example_${safeName}_block_${block.blockIndex}.ts`,
    );
    virtualFiles.set(virtualPath, {
      block,
      text: normalizeVirtualCode(block.code),
    });
  }

  const host: ts.CompilerHost = {
    ...baseHost,
    fileExists: (fileName) => virtualFiles.has(resolve(fileName)) || baseHost.fileExists(fileName),
    readFile: (fileName) => {
      const entry = virtualFiles.get(resolve(fileName));
      return entry ? entry.text : baseHost.readFile(fileName);
    },
    getSourceFile: (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
      const entry = virtualFiles.get(resolve(fileName));
      if (entry) {
        return ts.createSourceFile(fileName, entry.text, languageVersion, true, ts.ScriptKind.TS);
      }
      return baseHost.getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
    },
    resolveModuleNameLiterals: (
      moduleLiterals,
      containingFile,
      redirectedReference,
      compilerOptions,
      containingSourceFile,
      reusedNames,
    ) => {
      return moduleLiterals.map((literal) => {
        if (literal.text === 'kong-api-client') {
          return {
            resolvedModule: {
              resolvedFileName: ENTRY_FILE,
              extension: ts.Extension.Ts,
              isExternalLibraryImport: false,
            },
          };
        }
        if (baseHost.resolveModuleNameLiterals) {
          const [resolved] = baseHost.resolveModuleNameLiterals(
            [literal],
            containingFile,
            redirectedReference,
            compilerOptions,
            containingSourceFile,
            reusedNames,
          );
          if (resolved) {
            return resolved;
          }
        }
        return ts.resolveModuleName(literal.text, containingFile, compilerOptions, baseHost);
      });
    },
  };

  const rootNames = [...virtualFiles.keys()];
  const program = ts.createProgram(rootNames, options, host);
  const failures: string[] = [];

  for (const [virtualPath, { block }] of virtualFiles) {
    const sourceFile = program.getSourceFile(virtualPath);
    if (!sourceFile) {
      failures.push(`${block.sourceFile} block #${block.blockIndex}: could not load virtual file`);
      continue;
    }
    const diagnostics = ts.getPreEmitDiagnostics(program, sourceFile);
    for (const diagnostic of diagnostics) {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      let location = `${block.sourceFile}:${block.startLine}`;
      if (diagnostic.start !== undefined) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(diagnostic.start);
        location = `${block.sourceFile}:${block.startLine + line}:${character + 1}`;
      }
      failures.push(`${location} (block #${block.blockIndex}) TS${diagnostic.code}: ${message}`);
    }
  }

  return failures;
}

describe('documentation TypeScript examples contract', () => {
  const markdownFiles = collectMarkdownFiles();
  const allBlocks = markdownFiles.flatMap((file) => extractTypeScriptBlocks(file));
  const checkedBlocks = allBlocks.filter((block) => !block.skipped);
  const skippedBlocks = allBlocks.filter((block) => block.skipped);

  it('finds TypeScript examples in README.md and every guide under docs/*.md', () => {
    expect(markdownFiles).toEqual([
      'README.md',
      'docs/admin-endpoints.md',
      'docs/errors.md',
      'docs/getting-started.md',
      'docs/migration.md',
      'docs/resources.md',
    ]);
    for (const file of markdownFiles) {
      const fileBlocks = checkedBlocks.filter((block) => block.sourceFile === file);
      expect(
        fileBlocks.length,
        `expected at least one checked ts block in ${file}`,
      ).toBeGreaterThan(0);
    }
    expect(skippedBlocks).toHaveLength(0);
  });

  it('compiles every checked TypeScript example cleanly against src/index.ts', () => {
    const failures = compileBlocks(checkedBlocks);
    expect(failures).toEqual([]);
  });
});
