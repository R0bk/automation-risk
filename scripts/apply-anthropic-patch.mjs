#!/usr/bin/env node
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const patchConfigs = [
  {
    name: 'Anthropic',
    patchPath: path.join(rootDir, 'patches', '@ai-sdk+anthropic+2.0.23.patch'),
    targets: [
      path.join(rootDir, 'node_modules', '@ai-sdk', 'anthropic', 'dist', 'index.js'),
      path.join(rootDir, 'node_modules', '@ai-sdk', 'anthropic', 'dist', 'index.mjs'),
      path.join(rootDir, 'node_modules', '@ai-sdk', 'anthropic', 'dist', 'internal', 'index.js'),
      path.join(rootDir, 'node_modules', '@ai-sdk', 'anthropic', 'dist', 'internal', 'index.mjs')
    ],
    verificationMarker: 'handledServerToolResult = false'
  },
  {
    name: 'AI SDK',
    patchPath: path.join(rootDir, 'patches', 'ai+5.0.56.patch'),
    targets: [
      path.join(rootDir, 'node_modules', 'ai', 'dist', 'index.js'),
      path.join(rootDir, 'node_modules', 'ai', 'dist', 'index.mjs')
    ],
    verificationMarker: 'const isProviderManagedTool = toolName === "web_search" || toolName === "web_fetch" || toolName === "code_execution"'
  }
];

function applyPatch({ name, patchPath, targets, verificationMarker }) {
  if (!existsSync(patchPath)) {
    console.warn(`[postinstall] ${name} patch file missing; skipping.`);
    return;
  }

  const availableTargets = targets.filter((target) => existsSync(target));
  if (availableTargets.length === 0) {
    console.warn(`[postinstall] ${name} targets not found; skipping.`);
    return;
  }

  const patchContent = readFileSync(patchPath, 'utf8');
  const result = spawnSync('patch', ['-p1', '--forward'], {
    cwd: rootDir,
    input: patchContent,
    encoding: 'utf8'
  });

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      console.error('[postinstall] "patch" command not found. Install GNU patch to apply required SDK fixes.');
      process.exit(1);
    }
    console.error(`[postinstall] Failed to spawn patch process for ${name}.`, result.error);
    process.exit(1);
  }

  const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  const alreadyApplied = combined.includes('Reversed (or previously applied) patch detected') ||
    combined.includes('Ignoring previously applied (or reversed) patch');
  const statusOk = result.status === 0 || alreadyApplied;

  if (!statusOk) {
    console.error(`[postinstall] Failed to apply ${name} patch. Output:\n`, combined);
    process.exit(result.status ?? 1);
  }

  const missingMarker = availableTargets.some((target) => {
    try {
      return !readFileSync(target, 'utf8').includes(verificationMarker);
    } catch (error) {
      console.error(`[postinstall] Unable to verify ${name} patch for ${target}.`, error);
      return true;
    }
  });

  if (missingMarker) {
    console.error(`[postinstall] ${name} patch did not modify targets as expected. Patch output:\n`, combined);
    process.exit(1);
  }

  for (const target of availableTargets) {
    for (const suffix of ['.rej', '.rej.orig']) {
      const rejectPath = `${target}${suffix}`;
      if (existsSync(rejectPath)) {
        try {
          rmSync(rejectPath, { force: true });
        } catch {
          // ignore cleanup failures
        }
      }
    }
  }

  const message = combined.length > 0 ? `\n${combined}` : '';
  console.log(`[postinstall] ${name} patch verified.${message}`);
}

for (const config of patchConfigs) {
  applyPatch(config);
}
