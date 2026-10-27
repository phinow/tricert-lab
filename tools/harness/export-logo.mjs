// v7 logo set ("Modern night"): one flame on a dark tile, Geist wordmark.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
// Run from anywhere: paths are relative to the repository root.
process.chdir(path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..'));
const geist = fs.readFileSync('public/fonts/geist-latin-wght-normal.woff2').toString('base64');
const OUT = 'M0 0C-12 0-16-9-14-18C-12-27-3-30 2-44C6-33 15-26 15-16C15-7 11 0 0 0Z';
const INN = 'M0 0C-6 0-8-5-7-10C-6-16-1-18 1-26C4-19 8-15 8-9C8-4 5 0 0 0Z';
const ember = '#ff7a33';
const core = '#ffc3a3';
const markBody = `<rect width="64" height="64" rx="18" fill="#18181b"/><g transform="translate(32 50) scale(0.82)"><path d="${OUT}" fill="${ember}"/><path d="${INN}" fill="${core}"/></g>`;
const mark = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${markBody}</svg>`;
fs.writeFileSync('public/favicon.svg', mark(64) + '\n');
fs.writeFileSync('public/tricert-mark.svg', mark(512) + '\n');

// The 13-week track, as on Today: weeks 1 to 9 done, week 10 under way.
const weeks = [5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 0, 0, 0];
const gates = { 6: 'PL-300, ITIL', 10: 'PMP', 13: 'CISSP' };
const trackW = 1040, gap = 10, cell = (trackW - gap * 12) / 13;
const track = `<div style="position:relative;width:${trackW}px;height:74px">${weeks.map((done, i) => {
  const x = i * (cell + gap);
  const label = gates[i + 1] ? `<span style="position:absolute;left:${x + cell / 2}px;top:0;transform:translateX(${i === 12 ? '-70%' : '-50%'});font:600 15px G;letter-spacing:.06em;color:#8b8b94;white-space:nowrap">${gates[i + 1]}</span>` : '';
  return `${label}<span style="position:absolute;left:${x}px;top:32px;width:${cell}px;height:16px;border-radius:5px;background:#27282d;overflow:hidden"><span style="display:block;height:100%;width:${(done / 5) * 100}%;background:${ember}"></span></span><span style="position:absolute;left:${x}px;top:56px;width:${cell}px;text-align:center;font:500 15px G;color:${i === 9 ? '#f4f4f5' : '#8b8b94'}">${i + 1}</span>`;
}).join('')}</div>`;

const css = `@font-face{font-family:G;src:url(data:font/woff2;base64,${geist}) format('woff2');font-weight:100 900}
*{margin:0;box-sizing:border-box}body{background:transparent}`;
const b = await chromium.launch();
async function shot(w, h, html, out, transparent = false) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.setContent(`<style>${css}</style>${html}`);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: out, omitBackground: transparent });
  await p.close();
}
const word = (size) => `<span style="font:600 ${size}px G;letter-spacing:-.035em;color:#f4f4f5">TriCert Lab</span>`;
await shot(1600, 520, `<div style="display:flex;align-items:center;gap:52px;height:520px;padding:0 100px 0 80px;background:#09090b;border-radius:64px">${mark(340)}${word(168)}</div>`, 'public/tricert-lab-logo.png', true);
await shot(1200, 630, `<div style="position:relative;width:1200px;height:630px;background:#09090b;overflow:hidden">
<div style="position:absolute;left:80px;top:64px;display:flex;align-items:center;gap:22px">${mark(72)}${word(44)}</div>
<p style="position:absolute;left:80px;top:180px;font:600 68px/1.04 G;letter-spacing:-.04em;color:#f4f4f5;width:960px">Four certifications. Thirteen weeks. One session at a time.</p>
<div style="position:absolute;left:80px;bottom:64px">${track}</div></div>`, 'public/og.png');
await shot(180, 180, `<div style="background:#18181b;width:180px;height:180px">${mark(180).replace('rx="18"', 'rx="0"')}</div>`, 'public/apple-touch-icon.png');
await shot(512, 512, mark(512), 'public/icon-512.png', true);
await b.close();
console.log('ok');
