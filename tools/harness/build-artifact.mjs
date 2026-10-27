import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname);
const project = path.join(here, '..', '..');
const out = path.join(here, 'out', 'artifact');
mkdirSync(out, { recursive: true });
const result = await build({
  entryPoints: [path.join(here, 'entry-artifact.tsx')], bundle: true, format: 'iife', write: false, minify: true,
  jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
  alias: { '@app': path.join(project, 'app'), '@': project }, nodePaths: [path.join(here, 'node_modules')], logLevel: 'warning',
});
let js = result.outputFiles[0].text.replaceAll('"/datasets/', '"datasets/').replaceAll('"/tricert-lab-logo.png"', '"tricert-lab-logo.png"');
cpSync(path.join(project, 'app', 'globals.css'), path.join(out, 'input.css'));
execFileSync(path.join(here, 'node_modules', '.bin', 'tailwindcss'), ['-i', path.join(out, 'input.css'), '-o', path.join(out, 'app.css'), '--minify'], { cwd: here, stdio: 'inherit' });
let css = readFileSync(path.join(out, 'app.css'), 'utf8');
for (const f of ['geist-latin-wght-normal.woff2', 'geist-latin-ext-wght-normal.woff2', 'geist-mono-latin-wght-normal.woff2']) {
  const b64 = readFileSync(path.join(project, 'public', 'fonts', f)).toString('base64');
  css = css.replaceAll(`/fonts/${f}`, `data:font/woff2;base64,${b64}`);
}
// Sticky header clears the phone's top inset inside the viewer.
css += '';
if (js.includes('</script')) throw new Error('script contains </script');
// Apply the saved colour and appearance before the app paints.
const themeScript = `try{var p=JSON.parse(localStorage.getItem('tricert.ui.v3')||'{}');var r=document.documentElement;var t=p.theme==='light'?'light':p.theme==='system'&&p.v===7?'system':'dark';if(t!=='system')r.dataset.theme=t;r.dataset.accent=['beacon','rose','canola','glacier'].indexOf(p.accent)>-1?p.accent:'beacon';}catch(e){document.documentElement.dataset.theme='dark';}`;
const html = `<title>TriCert Lab</title>\n<script>${themeScript}</script>\n<style>${css}</style>\n<div id="root"></div>\n<script>${js}</script>\n`;
writeFileSync(path.join(out, 'index.html'), html);
cpSync(path.join(project, 'public', 'datasets'), path.join(out, 'datasets'), { recursive: true });
cpSync(path.join(project, 'public', 'tricert-lab-logo.png'), path.join(out, 'tricert-lab-logo.png'));
console.log('html bytes', html.length, 'font inlined', !css.includes('/fonts/'), 'abs datasets left', (js.match(/"\/datasets\//g) || []).length);
