// Usage: node build.mjs <name> <projectDir>
// Bundles <projectDir>/app/tricert-app.tsx with the harness entry, compiles
// <projectDir>/app/globals.css through Tailwind, and writes out/<name>/.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const [name, projectDir] = process.argv.slice(2);
if (!name || !projectDir) throw new Error('usage: node build.mjs <name> <projectDir>');
const here = path.dirname(new URL(import.meta.url).pathname);
const outDir = path.join(here, 'out', name);
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [path.join(here, 'entry.tsx')],
  bundle: true,
  format: 'esm',
  outfile: path.join(outDir, 'app.js'),
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"' },
  alias: {
    '@app': path.join(projectDir, 'app'),
    '@': projectDir,
  },
  nodePaths: [path.join(here, 'node_modules')],
  logLevel: 'warning',
});

// Tailwind resolves `@import 'tailwindcss'` relative to the CSS file, so compile a copy from inside the harness.
cpSync(path.join(projectDir, 'app', 'globals.css'), path.join(outDir, 'input.css'));
execFileSync(path.join(here, 'node_modules', '.bin', 'tailwindcss'), ['-i', path.join(outDir, 'input.css'), '-o', path.join(outDir, 'app.css')], {
  cwd: here,
  stdio: 'inherit',
});

// Public assets referenced by the page (logo, datasets).
for (const asset of ['tricert-lab-logo.png', 'favicon.svg']) {
  const from = path.join(projectDir, 'public', asset);
  if (existsSync(from)) cpSync(from, path.join(outDir, asset));
}
for (const dir of ['datasets', 'fonts']) {
  const from = path.join(projectDir, 'public', dir);
  if (existsSync(from)) cpSync(from, path.join(outDir, dir), { recursive: true });
}

// Pull <link> tags (fonts) out of layout.tsx if the version under test adds any.
const layout = readFileSync(path.join(projectDir, 'app', 'layout.tsx'), 'utf8');
const links = [...layout.matchAll(/<link[^>]*\/>/g)].map((match) => match[0].replace(/crossOrigin=/g, 'crossorigin=').replace(/\{"?([^}]*)"?\}/g, '"$1"'));

writeFileSync(
  path.join(outDir, 'index.html'),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>TriCert Lab (${name})</title>${links.join('')}<link rel="stylesheet" href="app.css"></head><body><div id="root"></div><script type="module" src="app.js"></script></body></html>`,
);
console.log(`built ${outDir}`);
