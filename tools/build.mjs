// Bach Chorale Studio data build.
// Reads the Humdrum encodings from craigsapp/bach-371-chorales and writes everything
// the page loads: chorales.json (index), glyphs.json (shared music font glyphs) and
// scores/NN-w.txt / NN-n.txt (pre-engraved scores + playback data, ten chorales per
// file, gzipped and base64-encoded so any static host serves them as plain text).
//
// Usage:  node build.mjs <path-to-bach-371-chorales/kern> <output-dir> [limit]
import createVerovioModule from 'verovio/wasm-hum';
import { VerovioToolkit } from 'verovio/esm';
import { parseHTML } from 'linkedom';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const KERN_DIR = process.argv[2];
const OUT = process.argv[3];
const LIMIT = +process.argv[4] || Infinity;
if (!KERN_DIR || !OUT) {
  console.error('Usage: node build.mjs <path-to-bach-371-chorales/kern> <output-dir> [limit]');
  process.exit(1);
}
const M = await createVerovioModule();
const tk = new VerovioToolkit(M);

/* ---------- Index metadata from the reference records ---------- */
const MODES = { dor: 'Dorian', phr: 'Phrygian', lyd: 'Lydian', mix: 'Mixolydian', aeo: 'Aeolian', ion: 'Ionian', loc: 'Locrian' };
function keyName(k) {
  const [t, mode] = k.split(':');
  const nm = t[0].toUpperCase() + t.slice(1).replace(/-/g, '♭').replace(/#/g, '♯');
  return nm + ' ' + (mode ? (MODES[mode] || mode) : (t[0] === t[0].toUpperCase() ? 'major' : 'minor'));
}
const unescapeHtml = (s) => parseHTML(`<p>${s}</p>`).document.querySelector('p').textContent;
const data = [];
for (const f of fs.readdirSync(KERN_DIR).filter((f) => f.endsWith('.krn')).sort()) {
  const lines = fs.readFileSync(path.join(KERN_DIR, f), 'utf8').split('\n');
  const meta = {};
  for (const l of lines) {
    const m = l.match(/^!!!([^:]+):\s*(.*)$/);
    if (m && !(m[1] in meta)) meta[m[1]] = m[2].trim();
  }
  const body = lines.filter((l) => !l.startsWith('!!') && l.trim() !== '');
  const keyLine = body.find((l) => /^\*[a-gA-G][#\-]?:/.test(l));
  const meterLine = body.find((l) => /^\*M\d/.test(l));
  data.push({
    n: +meta['PC#'],
    de: unescapeHtml(meta['OTL@@DE'] || ''),
    en: unescapeHtml(meta['OTL@EN'] || ''),
    bwv: (meta.SCT || '').replace('BWV', '').trim(),
    key: keyLine ? keyName(keyLine.split('\t')[0].slice(1)) : '',
    meter: meterLine ? meterLine.split('\t')[0].slice(2) : '',
    kern: body.join('\n') + '\n',
  });
}
data.sort((a, b) => a.n - b.n);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'chorales.json'), JSON.stringify(data.map(({ kern, ...m }) => m)));

// width profiles: CSS px the system is laid out for, and verovio scale
const PROFILES = { w: { px: 1060, scale: 46, ml: 40 }, n: { px: 380, scale: 32, ml: 20 } };
const glyphs = new Map();

const PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
function kernPitch(tok) {
  if (tok.includes('r')) return null;
  const m = tok.match(/([a-gA-G]+)([#\-n]*)/);
  if (!m) return null;
  const l = m[1], low = l[0] === l[0].toLowerCase();
  const oct = low ? 3 + l.length : 4 - l.length;
  const acc = (m[2].match(/#/g) || []).length - (m[2].match(/-/g) || []).length;
  return 12 * (oct + 1) + PC[l[0].toLowerCase()] + acc;
}
function variantKern(kern, layout) {
  let lines = kern.split('\n');
  if (layout === 'c') lines = lines.map((l) => /^\*clef/.test(l) ? '*clefF4\t*clefC4\t*clefC3\t*clefC1' : l);
  let out = lines.join('\n');
  if (layout === 'kbd') out += '!!!filter: satb2gs\n';
  return out;
}
function kernDur(tok) {
  const m = tok.match(/(\d+)(\.*)/);
  if (!m) return 0;
  const r = +m[1], base = r === 0 ? 8 : 4 / r;
  return base * (2 - Math.pow(0.5, m[2].length));
}
function sections(kern) {
  const labels = [];
  let full = null, norep = null, t = 0, ends = null;
  for (const l of kern.split('\n')) {
    if (!l) continue;
    const f0 = l.split('\t')[0];
    if (f0.startsWith('*>norep[')) { norep = f0.slice(8, -1).split(','); continue; }
    if (f0.startsWith('*>[')) { full = f0.slice(3, -1).split(','); continue; }
    if (f0.startsWith('*>')) { labels.push({ name: f0.slice(2), q: t }); continue; }
    if ('*!='.includes(l[0])) continue;
    const toks = l.split('\t');
    if (!ends) ends = toks.map(() => 0);
    const t0 = t;
    toks.forEach((tok, j) => { if (tok !== '.') ends[j] = t0 + kernDur(tok); });
    const nxt = ends.filter((e) => e > t0 + 1e-9);
    t = nxt.length ? Math.min(...nxt) : t0;
  }
  const span = {};
  labels.forEach((lb, i) => { span[lb.name] = [lb.q, i + 1 < labels.length ? labels[i + 1].q : t]; });
  return { span, full, norep, end: t };
}
function analyze(kern) {
  const info = new Map();
  kern.split('\n').forEach((l, i) => {
    if (!l || '*!='.includes(l[0])) return;
    l.split('\t').forEach((tok, j) => {
      if (tok === '.') return;
      const p = kernPitch(tok);
      if (p == null) return;
      info.set(`note-L${i + 1}F${j + 1}`, { part: 3 - j, pitch: p, tieEnd: /[\]_]/.test(tok), ferm: /;(?!y)/.test(tok) });
    });
  });
  tk.setOptions({ inputFrom: 'humdrum', breaks: 'none' });
  tk.loadData(kern);
  const tm = tk.renderToTimemap({ includeMeasures: true });
  const open = new Map(), occ = [];
  let total = 0;
  for (const e of tm) {
    for (const id of e.off || []) { const o = open.get(id); if (o) { o.q1 = e.qstamp; open.delete(id); } }
    for (const id of e.on || []) {
      const inf = info.get(id); if (!inf) continue;
      const o = { id, ...inf, q0: e.qstamp, q1: e.qstamp };
      open.set(id, o); occ.push(o);
    }
    total = Math.max(total, e.qstamp);
  }
  occ.sort((a, b) => a.q0 - b.q0 || a.part - b.part);
  const events = [], last = [null, null, null, null];
  for (const o of occ) {
    const prev = last[o.part];
    if (o.tieEnd && prev && prev.pitch === o.pitch && Math.abs(prev.q1 - o.q0) < 1e-6) { prev.q1 = o.q1; continue; }
    const ev = { part: o.part, pitch: o.pitch, q0: o.q0, q1: o.q1 };
    events.push(ev); last[o.part] = ev;
  }
  const spans = occ.filter((o) => o.ferm).map((o) => [o.q0, o.q1]).sort((a, b) => a[0] - b[0]);
  const ferm = [];
  for (const s of spans) {
    const t = ferm[ferm.length - 1];
    if (t && s[0] <= t[1] + 1e-6) t[1] = Math.max(t[1], s[1]); else ferm.push([...s]);
  }
  return { events: events.map((e) => [e.part, e.pitch, r4(e.q0), r4(e.q1)]), ferm: ferm.map(([a, b]) => [r4(a), r4(b)]), total: r4(total) };
}
const r4 = (x) => Math.round(x * 10000) / 10000;

function render(kern, layout, prof) {
  const P = PROFILES[prof];
  tk.setOptions({
    inputFrom: 'humdrum', breaks: 'auto', scale: P.scale,
    pageWidth: Math.round(P.px * 100 / P.scale), pageHeight: 60000, adjustPageHeight: true,
    pageMarginLeft: P.ml, pageMarginRight: 20, pageMarginTop: 30, pageMarginBottom: 20,
    header: 'none', footer: 'none', spacingNonLinear: 0.58, spacingSystem: 10,
    svgViewBox: true, svgRemoveXlink: true, svgFormatRaw: true,
  });
  tk.loadData(variantKern(kern, layout));
  const svgText = tk.renderToSVG(1).replace(' version="1.1"', '').replace(' xmlns:xlink="http://www.w3.org/1999/xlink"', '');
  const { document } = parseHTML(`<!doctype html><html><body>${svgText}</body></html>`);
  const svg = document.querySelector('svg');
  const sfx = svg.getAttribute('id');
  // shared glyphs
  svg.querySelectorAll('defs > *').forEach((g) => {
    const id = g.getAttribute('id').replace('-' + sfx, '');
    if (!glyphs.has(id)) { g.setAttribute('id', id); glyphs.set(id, g.outerHTML); }
  });
  svg.querySelector('defs')?.remove();
  svg.querySelector('style')?.remove();
  svg.querySelector('desc')?.remove();
  svg.querySelectorAll('use').forEach((u) => u.setAttribute('href', u.getAttribute('href').replace('-' + sfx, '')));
  // voice tags
  const partOf = new Map();
  svg.querySelectorAll('g.measure').forEach((m) => {
    const staves = [...m.children].filter((c) => c.classList?.contains('staff'));
    staves.forEach((st, si) => {
      if (layout === 'kbd') {
        [...st.children].filter((c) => c.classList?.contains('layer')).forEach((ly, li) => {
          const p = si * 2 + (li === 0 ? 0 : 1);
          ly.classList.add('vp' + p);
          ly.querySelectorAll('g.note, g.rest').forEach((n) => partOf.set(n.getAttribute('id'), p));
        });
      } else {
        st.classList.add('vp' + si);
        st.querySelectorAll('g.note, g.rest').forEach((n) => partOf.set(n.getAttribute('id'), si));
      }
    });
    [...m.children].filter((c) => c.classList?.contains('tie') || c.classList?.contains('fermata')).forEach((g) => {
      const mm = (g.getAttribute('id') || '').match(/^(?:tie|fermata)-(L\d+F\d+)/);
      if (!mm) return;
      const p = partOf.get('note-' + mm[1]) ?? partOf.get('rest-' + mm[1]);
      if (p != null) g.classList.add('vp' + p);
    });
  });
  if (layout !== 'kbd') svg.querySelectorAll('g.system').forEach((sys) => {
    [...sys.children].filter((c) => c.classList?.contains('label')).forEach((g, i) => g.classList.add('vp' + (i % 4)));
  });
  // timing for display
  const tm = tk.renderToTimemap({ includeMeasures: true });
  const open = new Map(), occ = [], measures = [];
  for (const e of tm) {
    for (const id of e.off || []) { const o = open.get(id); if (o) { o[2] = r4(e.qstamp); open.delete(id); } }
    for (const id of e.on || []) {
      if (!id.startsWith('note')) continue;
      const o = [id, r4(e.qstamp), r4(e.qstamp)];
      open.set(id, o); occ.push(o);
    }
    if (e.measureOn) {
      let n = '';
      try { n = tk.getElementAttr(e.measureOn).n || ''; } catch {}
      measures.push([e.measureOn, r4(e.qstamp), n]);
    }
  }
  // keep only ids the page uses
  const keep = new Set([...occ.map((o) => o[0]), ...measures.map((m) => m[0])]);
  svg.querySelectorAll('[id]').forEach((el) => { if (el !== svg && !keep.has(el.getAttribute('id'))) el.removeAttribute('id'); });
  svg.removeAttribute('id');
  // drop empty milestone groups
  svg.querySelectorAll('g').forEach((g) => { if (!g.children.length && !g.getAttribute('id') && !g.textContent.trim()) g.remove(); });
  let out = svg.outerHTML.replace(/\s+class="([^"]*)"/g, (s, c) => ` class="${c.trim().replace(/\s+/g, ' ')}"`);
  return { svg: out, occ, measures };
}

/* ---------- Score bundles ---------- */
const chunks = new Map();
let n = 0;
for (const c of data) {
  if (n++ >= LIMIT) break;
  const a = analyze(variantKern(c.kern, 'mod'));
  const sec = sections(c.kern);
  const base = { n: c.n, ...a, sec: { span: sec.span, full: sec.full, norep: sec.norep } };
  const key = String(Math.floor((c.n - 1) / 10)).padStart(2, '0');
  for (const prof of Object.keys(PROFILES)) {
    const rec = { ...base, view: {} };
    for (const layout of ['kbd', 'c', 'mod']) rec.view[layout] = render(c.kern, layout, prof);
    const k = key + '-' + prof;
    if (!chunks.has(k)) chunks.set(k, []);
    chunks.get(k).push(rec);
  }
}
fs.mkdirSync(OUT + '/scores', { recursive: true });
let raw = 0, gz = 0;
for (const [k, recs] of chunks) {
  const s = JSON.stringify(recs).replace(/ \/>/g, '/>');
  const z = zlib.gzipSync(s, { level: 9 });
  raw += s.length; gz += z.length;
  fs.writeFileSync(`${OUT}/scores/${k}.txt`, z.toString('base64'));
}
fs.writeFileSync(`${OUT}/glyphs.json`, JSON.stringify([...glyphs.values()]));
console.log('chorales', Math.min(n, data.length), 'files', chunks.size, 'raw MB', (raw / 1e6).toFixed(1), 'gz MB', (gz / 1e6).toFixed(1), 'glyphs', glyphs.size);
