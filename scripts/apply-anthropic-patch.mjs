#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const patchPath = path.join(rootDir, 'patches', '@ai-sdk+anthropic+2.0.23.patch');
const targetFile = path.join(rootDir, 'node_modules', '@ai-sdk', 'anthropic', 'dist', 'index.js');
const marker = 'handledServerToolResult = false';

if (!existsSync(patchPath)) {
  console.warn('[postinstall] Anthropic patch file missing; skipping.');
  process.exit(0);
}

if (!existsSync(targetFile)) {
  console.warn('[postinstall] Anthropic package not installed; skipping patch.');
  process.exit(0);
}

try {
  const contents = readFileSync(targetFile, 'utf8');
  if (contents.includes(marker)) {
    console.log('[postinstall] Anthropic patch already applied.');
    process.exit(0);
  }
} catch (error) {
  console.warn('[postinstall] Unable to inspect Anthropic package; skipping patch.', error);
  process.exit(0);
}

const patchContent = readFileSync(patchPath, 'utf8');
const result = spawnSync('patch', ['-p1', '--forward'], {
  cwd: rootDir,
  input: patchContent,
  encoding: 'utf8'
});

if (result.error) {
  if (result.error.code === 'ENOENT') {
    console.error('[postinstall] "patch" command not found. Install GNU patch to apply Anthropic fix.');
    process.exit(1);
  }
  console.error('[postinstall] Failed to spawn patch process.', result.error);
  process.exit(1);
}

const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
if (result.status === 0) {
  console.log('[postinstall] Applied Anthropic patch successfully.');
  if (combined.length > 0) {
    console.log(combined);
  }
  process.exit(0);
}

if (combined.includes('Reversed (or previously applied) patch detected')) {
  console.log('[postinstall] Anthropic patch was already applied.');
  process.exit(0);
}

console.error('[postinstall] Failed to apply Anthropic patch. Output:\n', combined);
process.exit(result.status ?? 1);
