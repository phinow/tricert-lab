// v6 logo set: a beacon burning on a night ridge.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
// Run from anywhere: paths are relative to the repository root.
process.chdir(path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..'));
const fonts = 'public/fonts/';
const brico = fs.readFileSync(fonts + 'bricolage-grotesque-latin-standard-normal.woff2').toString('base64');
const lit = fs.readFileSync(fonts + 'literata-latin-wght-normal.woff2').toString('base64');
const OUT = 'M0 0C-12 0-16-9-14-18C-12-27-3-30 2-44C6-33 15-26 15-16C15-7 11 0 0 0Z';
const INN = 'M0 0C-6 0-8-5-7-10C-6-16-1-18 1-26C4-19 8-15 8-9C8-4 5 0 0 0Z';
const markBody = `<rect width="64" height="64" rx="16" fill="#1d2152"/><path d="M0 50C14 45 30 47 64 39V48C64 56.8 56.8 64 48 64H16C7.2 64 0 56.8 0 48Z" fill="#11143a"/><g transform="translate(32 46) scale(0.86)"><path d="${OUT}" fill="#ff6a1f"/><path d="${INN}" fill="#ffc94a"/></g>`;
const mark = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${markBody}</svg>`;
fs.writeFileSync('public/favicon.svg', mark(64) + '\n');
fs.writeFileSync('public/tricert-mark.svg', mark(512) + '\n');
// The ridge, same geometry as the app.
const H = 330, W = 1000;
const U = Array.from({ length: 13 }, (_, i) => 0.056 + i * (0.888 / 12));
const ground = (u) => 286 - 92 * Math.pow(u, 1.35) + 7 * Math.sin((u * 1000) / 61) + 4 * Math.sin((u * 1000) / 23 + 1);
const mid = (u) => 246 - 30 * Math.pow(u, 1.1) + 9 * Math.sin((u * 1000) / 90 + 2) + 5 * Math.sin((u * 1000) / 37);
const P = [[0, 170], [0.04, 128], [0.078, 160], [0.12, 104], [0.16, 150], [0.205, 118], [0.25, 166], [0.3, 138], [0.35, 182], [0.42, 176], [0.52, 206], [0.64, 214], [0.8, 222], [1, 214]];
const far = (u) => { for (let i = 0; i < P.length - 1; i++) { const [a, y1] = P[i], [b, y2] = P[i + 1]; if (u >= a && u <= b) return y1 + ((y2 - y1) * (u - a)) / (b - a); } return 214; };
const land = (fn) => { let d = `M0 ${H}`; for (let s = 0; s <= 100; s++) d += `L${(s / 100) * W} ${fn(s / 100).toFixed(1)}`; return d + `L${W} ${H}Z`; };
const gates = { 6: 1, 10: 1, 13: 1 };
const weeks = [5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 0, 0, 0];
let beacons = '';
U.forEach((u, i) => {
  const x = u * W, y = ground(u), n = weeks[i], gate = gates[i + 1], post = gate ? 58 : 30, bowl = gate ? 15 : 10, top = y - post, isLit = n >= 5;
  const s = n === 0 ? 0 : (gate ? 1.35 : 1) * (isLit ? 1 : 0.4 + n * 0.1);
  if (isLit) beacons += `<circle cx="${x}" cy="${top - 16 * s}" r="${38 * s}" fill="url(#glow)"/>`;
  beacons += `<rect x="${x - 1.6}" y="${top}" width="3.2" height="${post + 6}" fill="#0b0d26"/>`;
  if (gate) beacons += `<path d="M${x - 9} ${y + 2}L${x} ${top + 18}L${x + 9} ${y + 2}" stroke="#0b0d26" stroke-width="3" fill="none"/>`;
  beacons += `<path d="M${x - bowl} ${top - 6}H${x + bowl}L${x + bowl * 0.55} ${top + 2}H${x - bowl * 0.55}Z" fill="#0b0d26"/>`;
  beacons += n === 0 ? `<circle cx="${x}" cy="${top - 8}" r="${gate ? 3.4 : 2.6}" fill="#4b4f80"/>` : `<g transform="translate(${x} ${top - 5}) scale(${s})"><path d="${OUT}" fill="#ff6a1f"/><path d="${INN}" fill="#ffc94a"/></g>`;
});
const stars = [[0.09, 40, 1.9], [0.17, 82, 1.3], [0.24, 30, 1.3], [0.33, 66, 1.9], [0.42, 22, 1.3], [0.5, 58, 1.3], [0.59, 34, 1.9], [0.66, 88, 1.3], [0.73, 26, 1.3], [0.8, 60, 1.9], [0.88, 38, 1.3], [0.95, 80, 1.3], [0.13, 120, 1.9], [0.56, 110, 1.3]].map(([u, y, r], i) => `<circle cx="${u * W}" cy="${y}" r="${r}" fill="#fff" opacity="${i % 2 ? 0.45 : 0.75}"/>`).join('');
const ridge = `<svg viewBox="0 0 ${W} ${H}" width="1200" height="${(1200 * H) / W}"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#171b44"/><stop offset=".55" stop-color="#262a63"/><stop offset=".8" stop-color="#4b3f74"/><stop offset="1" stop-color="#b8695a"/></linearGradient><radialGradient id="glow"><stop offset="0" stop-color="#ffb347" stop-opacity=".55"/><stop offset="1" stop-color="#ff6a1f" stop-opacity="0"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#sky)"/>${stars}<path d="${land(far)}" fill="#34336b"/><path d="${land(mid)}" fill="#25265a"/><path d="${land(ground)}" fill="#141739"/>${beacons}</svg>`;
const css = `@font-face{font-family:B;src:url(data:font/woff2;base64,${brico}) format('woff2');font-weight:200 800}
@font-face{font-family:L;src:url(data:font/woff2;base64,${lit}) format('woff2');font-weight:200 900}
*{margin:0;box-sizing:border-box}body{background:transparent}`;
const b = await chromium.launch();
async function shot(w, h, html, out, transparent = false) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.setContent(`<style>${css}</style>${html}`);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: out, omitBackground: transparent });
  await p.close();
}
const word = (size) => `<span style="font:800 ${size}px B;letter-spacing:-.025em;color:#fff">TriCert Lab</span>`;
await shot(1600, 520, `<div style="display:flex;align-items:center;gap:52px;height:520px;padding:0 100px 0 80px;background:#141739;border-radius:64px">${mark(340)}${word(168)}</div>`, 'public/tricert-lab-logo.png', true);
await shot(1200, 630, `<div style="position:relative;width:1200px;height:630px;background:#171b44;overflow:hidden">
<div style="position:absolute;left:0;right:0;bottom:-40px">${ridge}</div>
<div style="position:absolute;left:80px;top:64px;display:flex;align-items:center;gap:24px">${mark(84)}${word(54)}</div>
<p style="position:absolute;left:80px;top:190px;font:800 66px/1.02 B;letter-spacing:-.028em;color:#fff;width:900px">Four certifications. Thirteen weeks. One beacon at a time.</p></div>`, 'public/og.png');
await shot(180, 180, `<div style="background:#11143a;width:180px;height:180px">${mark(180).replace('rx="16"', 'rx="0"')}</div>`, 'public/apple-touch-icon.png');
await shot(512, 512, mark(512), 'public/icon-512.png', true);
await b.close();
console.log('ok');
