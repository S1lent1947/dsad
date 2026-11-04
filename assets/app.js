import * as C from './core.js';
import { runPython, hintFor, getPy } from './runner.js';
import { PRESETS, SOLUTIONS, CHEAT } from './content.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const { esc } = C;
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const store = {
  get(k, d) { try { const v = localStorage.getItem('dsad.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('dsad.' + k, JSON.stringify(v)); } catch { /* fără stocare locală */ } },
};

const DEFAULTS = { dirIn: 'data_in/', dirOut: 'data_out/', mkdir: true, includeGroups: true, split: false, nan: 'auto' };
const S = {
  text: '',
  uploads: [],
  settings: { ...DEFAULTS, ...store.get('settings', {}), mainFile: '' },
  problem: C.parseProblem(''),
  ctx: null,
  reqs: [],
  gen: null,
  tab: 'main.py',
  edited: {},
  editing: false,
  run: null,
  preset: null,
  autoText: false,
  notice: '',
};
const IDE = new URLSearchParams(location.search).has('ide');
if (IDE) document.documentElement.classList.add('in-ide');

// ───────────── temă ─────────────
const root = document.documentElement;
const setTheme = (t) => { if (t) root.dataset.theme = t; else delete root.dataset.theme; };
setTheme(store.get('theme', ''));
$('#theme').addEventListener('click', () => {
  const cur = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = cur === 'dark' ? 'light' : 'dark';
  setTheme(next);
  store.set('theme', next);
});

// ───────────── navigare ─────────────
const VIEWS = ['rezolva', 'rezolvari', 'fituica', 'pycharm'];
function route() {
  const [v] = (location.hash || '#rezolva').slice(1).split('/');
  const view = VIEWS.includes(v) ? v : 'rezolva';
  for (const x of VIEWS) {
    $(`#view-${x}`).hidden = x !== view;
    $(`.nav a[data-view="${x}"]`).classList.toggle('on', x === view);
  }
  if (view === 'rezolvari') renderSolutions();
  if (view === 'fituica') renderCheat();
}
window.addEventListener('hashchange', route);

// ───────────── analiza și generarea ─────────────
function saveDraft() { if (!IDE) store.set('draft', { text: S.preset ? '' : S.text, preset: S.preset }); }

function analyze() {
  S.problem = C.parseProblem(S.text);
  S.ctx = C.buildContext(S.problem, S.uploads, S.settings);
  S.reqs = S.ctx.main ? C.detectAll(S.problem, S.ctx) : [];
  S.edited = {};
  S.editing = false;
  S.run = null;
  renderFiles();
  renderReqs();
  regen();
  renderRun();
  saveDraft();
}

function regen() {
  S.ctx = C.buildContext(S.problem, S.uploads, S.settings);
  S.gen = C.generate(S.ctx, S.reqs, S.settings);
  renderScript();
  renderReqCodes();
  renderWarnings();
}

// ───────────── fișiere ─────────────
const SRC_LABEL = { upload: 'încărcat', standard: 'coloane standard, neîncărcat', text: 'coloane din enunț, neîncărcat', lipsa: 'neîncărcat' };
function renderFiles() {
  const el = $('#fileList');
  const ctx = S.ctx;
  const files = ctx ? ctx.files : [];
  el.innerHTML = files.map((f) => {
    const isMain = ctx.main && f.name === ctx.main.name;
    const cols = f.header.map((h, j) => {
      const idx = f.firstUnique && j === 0;
      const num = f.types[j] && f.types[j].numeric;
      return `<span class="col ${idx ? 'idx' : num ? 'num' : 'txt'}" title="${idx ? 'index (index_col=0)' : num ? 'coloană numerică' : 'coloană text'}">${esc(h)}</span>`;
    }).join('');
    return `<div class="file${isMain ? ' main' : ''}" data-name="${esc(f.name)}">
      <div class="file-head">
        <span class="fname">${esc(f.name)}</span>
        ${isMain ? '<span class="tag main-tag">fișierul principal</span>' : f.header.length ? '<button class="link set-main" type="button">fă-l principal</button>' : ''}
        <span class="tag ${f.source}">${SRC_LABEL[f.source] || ''}${f.nRows ? `, ${f.nRows} rânduri` : ''}</span>
        ${f.source === 'upload' ? '<button class="icon-btn rm" type="button" title="Scoate fișierul" aria-label="Scoate fișierul">✕</button>' : ''}
      </div>
      ${f.header.length ? `<div class="cols">${cols}</div>` : '<p class="muted small">Încarcă fișierul ca să-i văd coloanele.</p>'}
    </div>`;
  }).join('');
}

// ───────────── PDF → text (pdf.js) ─────────────
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
let pdfjsP = null;
function loadPdfJs() {
  if (!pdfjsP) {
    pdfjsP = new Promise((ok, bad) => {
      if (window.pdfjsLib) return ok(window.pdfjsLib);
      const s = document.createElement('script');
      s.src = PDFJS + 'pdf.min.js';
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; ok(window.pdfjsLib); };
      s.onerror = () => bad(new Error('Nu am putut încărca cititorul de PDF. Verifică internetul.'));
      document.head.appendChild(s);
    });
    pdfjsP.catch(() => { pdfjsP = null; });
  }
  return pdfjsP;
}
async function pdfToText(data) {
  const lib = await loadPdfJs();
  const pdf = await lib.getDocument({ data }).promise;
  const out = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const tc = await page.getTextContent();
    const rows = [];
    for (const it of tc.items) {
      if (!it.str) continue;
      const y = it.transform[5];
      let row = rows.find((r) => Math.abs(r.y - y) < 2.5);
      if (!row) { row = { y, items: [] }; rows.push(row); }
      row.items.push({ x: it.transform[4], w: it.width, s: it.str });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) {
      r.items.sort((a, b) => a.x - b.x);
      let line = '';
      let end = null;
      for (const it of r.items) {
        if (end !== null && it.x - end > 1 && !/\s$/.test(line) && !/^\s/.test(it.s)) line += ' ';
        line += it.s;
        end = it.x + it.w;
      }
      if (line.trim()) out.push(line.replace(/\s+$/, ''));
    }
  }
  return out.join('\n');
}

async function addFiles(list) {
  const all = [...list];
  const pdf = all.find((f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf');
  const csvs = all.filter((f) => /\.csv$/i.test(f.name) || f.type === 'text/csv');
  if (!pdf && !csvs.length) return;
  for (const file of csvs) {
    const f = C.fileFromCSV(file.name, await file.text());
    S.uploads = S.uploads.filter((u) => u.name.toLowerCase() !== file.name.toLowerCase());
    S.uploads.push(f);
  }
  S.notice = '';
  if (pdf) {
    try {
      const text = await pdfToText(new Uint8Array(await pdf.arrayBuffer()));
      if (text.trim()) { S.text = text; $('#problem').value = text; }
      else S.notice = `Nu am găsit text în ${pdf.name} (poate e o poză scanată). Copiază textul de mână.`;
    } catch (e) {
      S.notice = `Nu am putut citi ${pdf.name}: ${(e && e.message) || e}`;
    }
  }
  S.preset = null;
  markPreset();
  analyze();
  getPy().catch(() => {}); // pregătesc Python în fundal, ca prima rulare să fie mai rapidă
}

const drop = $('#drop');
$('#fileInput').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'dragend'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('over')));
drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); });
$('#fileList').addEventListener('click', (e) => {
  const box = e.target.closest('.file');
  if (!box) return;
  const name = box.dataset.name;
  if (e.target.closest('.rm')) { S.uploads = S.uploads.filter((u) => u.name !== name); analyze(); }
  else if (e.target.closest('.set-main')) { S.settings.mainFile = name; analyze(); }
});

// ───────────── cerințe ─────────────
function colNames(from) {
  const ctx = S.ctx;
  if (from === 'raw') return ctx.main.header.slice();
  if (from === 'main') return ctx.cols.slice();
  if (from === 'vars') return ctx.vars.slice();
  if (from === 'numeric') return ctx.allCols.filter((c) => c.numeric).map((c) => c.name);
  return ctx.allCols.map((c) => c.name);
}
function optionTags(list, value) {
  let html = list.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(value ?? '') ? ' selected' : ''}>${esc(l)}</option>`).join('');
  if (value && !list.some(([v]) => String(v) === String(value))) html += `<option value="${esc(value)}" selected>${esc(value)} (nu există)</option>`;
  return html;
}
const OUT_NAMES = { cov: 'covarianța', corr: 'corelația', std: 'standardizarea', varianta: 'varianța', corelatii: 'corelații', scoruri: 'scoruri', cosinusuri: 'cosinusuri', contributii: 'contribuții', comunalitati: 'comunalități' };
const OUT_DEFAULT = { cov: 'V.csv', corr: 'R.csv', std: 'x_std.csv', varianta: 'Varianta.csv', corelatii: 'r.csv', scoruri: 's.csv', cosinusuri: 'cosin.csv', contributii: 'contrib.csv', comunalitati: 'comm.csv' };

function fieldHTML(f, r) {
  const ctx = S.ctx;
  const p = r.params;
  const v = p[f.k];
  const id = `f-${r.id}-${f.k}`;
  const lab = `<label for="${id}">${esc(f.label)}</label>`;
  const sel = (list) => `<div class="fld">${lab}<select id="${id}" data-k="${f.k}">${optionTags(list, v)}</select></div>`;
  switch (f.type) {
    case 'col': {
      const list = [];
      if (f.optional) list.push(['', 'niciuna']);
      if (f.allowTotal) list.push(['__total__', `totalul (suma ${ctx.varsName})`]);
      for (const n of colNames(f.from || 'all')) list.push([n, n]);
      return sel(list);
    }
    case 'group': {
      const list = [];
      if (f.optional) list.push(['', 'niciuna']);
      if (f.includeRow) list.push(['__rand__', 'fiecare rând']);
      for (const n of ctx.groupCols) list.push([n, n]);
      return sel(list);
    }
    case 'select':
      return sel(f.options.map((o) => (Array.isArray(o) ? o : [o, o])));
    case 'src': {
      const i = S.reqs.indexOf(r);
      return sel([['main', 'fișierul principal'], ...S.reqs.slice(0, i).filter((x) => x.type === 'pivot').map((x) => [x.id, `rezultatul cerinței ${x.id}`])]);
    }
    case 'text':
      return `<div class="fld">${lab}<input id="${id}" type="text" data-k="${f.k}" value="${esc(v ?? '')}" placeholder="${esc(f.placeholder || '')}" spellcheck="false" autocomplete="off"></div>`;
    case 'bool':
      return `<div class="fld chk"><input id="${id}" type="checkbox" data-k="${f.k}"${v ? ' checked' : ''}><label for="${id}">${esc(f.label)}</label></div>`;
    case 'code':
      return `<div class="fld wide">${lab}<textarea id="${id}" data-k="${f.k}" rows="7" spellcheck="false">${esc(v ?? '')}</textarea></div>`;
    case 'cols':
    case 'groups':
    case 'multi': {
      let list;
      if (f.type === 'cols') list = colNames(f.from || 'all').map((n) => [n, n]);
      else if (f.type === 'groups') list = [...(f.includeRow ? [['__rand__', 'fiecare rând']] : []), ...ctx.groupCols.map((n) => [n, n])];
      else list = f.options;
      const on = new Set(v || []);
      const chips = list.map(([ov, ol]) => `<button type="button" class="chip${on.has(ov) ? ' on' : ''}" data-v="${esc(ov)}" aria-pressed="${on.has(ov)}">${esc(ol)}</button>`).join('');
      const all = f.type === 'cols' ? '<button type="button" class="chip-all" data-all="1">toate</button><button type="button" class="chip-all" data-all="0">niciuna</button>' : '';
      return `<div class="fld wide"><span class="lbl">${esc(f.label)}</span><div class="chips" data-k="${f.k}">${chips}${all}</div></div>`;
    }
    case 'outs': {
      const keys = p.what || p.parts || [];
      if (!keys.length) return '';
      const outs = p.outs || {};
      return `<div class="fld wide"><span class="lbl">${esc(f.label)}</span><div class="outs-grid">${keys.map((k) => `<label>${esc(OUT_NAMES[k] || k)} <input type="text" data-outs="${k}" value="${esc(outs[k] || OUT_DEFAULT[k] || '')}" spellcheck="false"></label>`).join('')}</div></div>`;
    }
    default:
      return '';
  }
}
const fieldsHTML = (r) => C.TEMPLATES[r.type].fields.filter((f) => !f.showIf || f.showIf(r.params)).map((f) => fieldHTML(f, r)).join('');

function reqCard(r) {
  const T = C.TEMPLATES[r.type];
  const opts = C.TEMPLATE_ORDER.map((id) => `<option value="${id}"${id === r.type ? ' selected' : ''}>${esc(C.TEMPLATES[id].title)}</option>`).join('');
  const ex = r.example ? `<pre class="ex-lines" title="Exemplul din enunț">${esc([r.example.header.join(','), ...r.example.rows.map((x) => x.join(','))].join('\n'))}</pre>` : '';
  return `<article class="req" data-id="${esc(r.id)}">
    <div class="req-head">
      <span class="req-num">${esc(r.id)}</span>
      <select class="req-type" aria-label="Tipul cerinței ${esc(r.id)}">${opts}</select>
      ${r.points ? `<span class="pts">${esc(r.points)}p</span>` : ''}
      <span class="req-check" data-check="${esc(r.id)}"></span>
      <button class="icon-btn req-del" type="button" title="Scoate cerința" aria-label="Scoate cerința ${esc(r.id)}">✕</button>
    </div>
    ${r.desc ? `<p class="req-desc" title="Apasă ca să vezi tot textul">${esc(r.desc)}</p>` : ''}
    <p class="req-help">${esc(T.help)}</p>
    ${ex}
    <div class="fields">${fieldsHTML(r)}</div>
    <details class="req-code"><summary>Codul acestei cerințe</summary><pre></pre></details>
  </article>`;
}

function renderReqs() {
  const el = $('#reqs');
  const ctx = S.ctx;
  $('#addReq').hidden = !(ctx && ctx.main);
  if (!ctx || !ctx.main) {
    let msg = 'Cerințele apar aici după ce lipești subiectul.';
    if (ctx && ctx.missingMain) msg = `Încarcă fișierul ${ctx.missingMain}: din enunț nu reiese ce coloane are.`;
    else if (S.text.trim()) msg = 'Nu găsesc numele fișierului principal în text. Încarcă fișierele CSV.';
    el.innerHTML = `<p class="empty">${esc(msg)}</p>`;
    $('#reqSummary').textContent = '';
    return;
  }
  el.innerHTML = S.reqs.length ? S.reqs.map(reqCard).join('') : '<p class="empty">Nu găsesc cerințe numerotate (1., 2., …). Verifică dacă ai copiat tot textul sau adaugă o cerință de mână.</p>';
  const pts = S.problem.reqs.reduce((a, r) => a + (parseFloat(r.points) || 0), 0);
  const n = S.problem.reqs.length;
  $('#reqSummary').textContent = n ? `${n === 1 ? 'o cerință' : `${n} cerințe`}${pts ? `, ${String(pts).replace('.', ',')} puncte` : ''}` : '';
  renderReqCodes();
  renderChecks();
}

function renderReqCodes() {
  for (const r of S.reqs) {
    const pre = $(`.req[data-id="${CSS.escape(r.id)}"] .req-code pre`);
    if (pre) pre.innerHTML = C.highlightPy(r.code || '');
  }
}

function refreshCard(r, full = false) {
  const card = $(`.req[data-id="${CSS.escape(r.id)}"]`);
  if (!card) return;
  if (full) card.outerHTML = reqCard(r);
  else $('.fields', card).innerHTML = fieldsHTML(r);
}
const reqOf = (el) => { const card = el.closest('.req'); return card ? S.reqs.find((x) => x.id === card.dataset.id) : null; };

const reqsEl = $('#reqs');
reqsEl.addEventListener('change', (e) => {
  const t = e.target;
  const r = reqOf(t);
  if (!r) return;
  if (t.classList.contains('req-type')) {
    r.type = t.value;
    r.params = C.deriveParams(t.value, r, S.ctx, S.reqs.slice(0, S.reqs.indexOf(r)));
    refreshCard(r, true);
    regen();
    renderChecks();
    return;
  }
  if (t.dataset.k) {
    r.params[t.dataset.k] = t.type === 'checkbox' ? t.checked : t.value;
    if (t.tagName === 'SELECT' || t.type === 'checkbox') refreshCard(r);
    regen();
  } else if (t.dataset.outs) {
    r.params.outs = { ...(r.params.outs || {}), [t.dataset.outs]: t.value };
    regen();
  }
});
reqsEl.addEventListener('input', debounce((e) => {
  const t = e.target;
  const r = reqOf(t);
  if (!r) return;
  if (t.dataset.k && (t.type === 'text' || t.tagName === 'TEXTAREA')) { r.params[t.dataset.k] = t.value; regen(); }
  else if (t.dataset.outs) { r.params.outs = { ...(r.params.outs || {}), [t.dataset.outs]: t.value }; regen(); }
}, 300));
reqsEl.addEventListener('click', (e) => {
  const t = e.target;
  const r = reqOf(t);
  if (!r) return;
  const chip = t.closest('.chip, .chip-all');
  if (chip) {
    const box = chip.closest('.chips');
    const k = box.dataset.k;
    const order = $$('.chip', box).map((c) => c.dataset.v);
    let cur = new Set(r.params[k] || []);
    if (chip.classList.contains('chip-all')) cur = new Set(chip.dataset.all === '1' ? order : []);
    else if (cur.has(chip.dataset.v)) cur.delete(chip.dataset.v);
    else cur.add(chip.dataset.v);
    r.params[k] = order.filter((x) => cur.has(x));
    refreshCard(r);
    regen();
    return;
  }
  if (t.closest('.req-del')) { S.reqs = S.reqs.filter((x) => x !== r); renderReqs(); regen(); return; }
  const d = t.closest('.req-desc');
  if (d) d.classList.toggle('open');
});

$('#addReq').addEventListener('click', () => {
  if (!S.ctx || !S.ctx.main) return;
  const nums = S.reqs.map((r) => parseInt(r.id, 10)).filter((n) => !isNaN(n));
  const num = (nums.length ? Math.max(...nums) : 0) + 1;
  const r = { id: String(num), num, desc: '', example: null, points: '', outFile: '', type: 'indicator_rand', params: null };
  r.params = C.deriveParams(r.type, r, S.ctx, S.reqs);
  S.reqs.push(r);
  renderReqs();
  regen();
  const card = $(`.req[data-id="${num}"]`);
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

// ───────────── panoul de cod ─────────────
const fileNames = () => (S.gen ? Object.keys(S.gen.files) : ['main.py']);
const codeOf = (name) => S.edited[name] ?? (S.gen && S.gen.files[name]) ?? '';
function allCode() { const o = {}; for (const n of fileNames()) o[n] = codeOf(n); return o; }
const lineNums = (code) => code.split('\n').map((_, i) => i + 1).join('\n');

function renderScript() {
  const names = fileNames();
  if (!names.includes(S.tab)) S.tab = names[0];
  $('#ftabs').innerHTML = names.map((n) => `<button class="ftab${n === S.tab ? ' on' : ''}" type="button" role="tab" aria-selected="${n === S.tab}" data-file="${n}">${n}${S.edited[n] != null ? '<i title="modificat de tine">●</i>' : ''}</button>`).join('');
  const code = codeOf(S.tab).replace(/\n$/, '');
  $('#gutter').textContent = lineNums(code);
  const ta = $('#codeEdit');
  if (S.editing) {
    if (document.activeElement !== ta) ta.value = code;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  } else {
    $('#code').innerHTML = C.highlightPy(code);
  }
  $('#code').hidden = S.editing;
  ta.hidden = !S.editing;
  $('#editBtn').textContent = S.editing ? 'Gata' : 'Editează';
  $('#resetBtn').hidden = !Object.keys(S.edited).length;
}

function renderWarnings() {
  const w = [...(S.notice ? [S.notice] : []), ...(S.gen ? S.gen.warn : [])];
  const ctx = S.ctx;
  if (Object.keys(S.edited).length) w.push('Ai modificat codul de mână, așa că schimbările de la cerințe nu mai apar în el. Apasă „Revino la codul generat” ca să le vezi.');
  if (ctx && ctx.main && ctx.main.source !== 'upload') w.push(`Nu ai încărcat ${ctx.main.name}, așa că numele coloanelor sunt luate din enunț. Încarcă fișierul ca să fie sigur exacte și ca să poți rula codul.`);
  $('#warnings').innerHTML = w.map((x) => `<p class="warn">${esc(x)}</p>`).join('');
}

$('#ftabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-file]');
  if (b) { S.tab = b.dataset.file; renderScript(); }
});
$('#editBtn').addEventListener('click', () => {
  S.editing = !S.editing;
  renderScript();
  if (S.editing) $('#codeEdit').focus();
});
$('#codeEdit').addEventListener('input', (e) => {
  const ta = e.target;
  S.edited[S.tab] = ta.value;
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
  $('#gutter').textContent = lineNums(ta.value);
  $('#resetBtn').hidden = false;
});
$('#codeEdit').addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  e.preventDefault();
  const ta = e.target;
  const { selectionStart: a, selectionEnd: b } = ta;
  ta.setRangeText('    ', a, b, 'end');
  ta.dispatchEvent(new Event('input'));
});
$('#codeEdit').addEventListener('blur', () => renderWarnings());
$('#resetBtn').addEventListener('click', () => { S.edited = {}; S.editing = false; renderScript(); renderWarnings(); });

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  if (btn) {
    const old = btn.textContent;
    btn.textContent = 'Copiat';
    setTimeout(() => { btn.textContent = old; }, 1400);
  }
}
function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
$('#copyBtn').addEventListener('click', (e) => copyText(codeOf(S.tab), e.currentTarget));
$('#dlBtn').addEventListener('click', () => download(S.tab, codeOf(S.tab)));

// ───────────── rulare și verificare ─────────────
function checksFor(reqs, outputs) {
  const res = {};
  for (const r of reqs) {
    if (!r.example || !r.example.rows) continue;
    const want = String(r.params.out || '').split('/').pop().toLowerCase();
    const o = outputs.find((x) => x.name.toLowerCase() === want);
    if (!o) { res[r.id] = { missing: true, name: r.params.out || '?' }; continue; }
    let c = C.compareOutput(r.example, o.text);
    c.file = o.name;
    if (!c.ok) {
      const stem = want.replace(/\.csv$/, '');
      for (const x of outputs) {
        if (x === o || !x.name.toLowerCase().startsWith(stem)) continue;
        const c2 = C.compareOutput(r.example, x.text);
        if (c2.ok) { c = c2; c.file = x.name; c.alt = true; break; }
      }
    }
    res[r.id] = c;
  }
  return res;
}

let blobUrls = [];
function runHTML(R, reqs) {
  blobUrls.forEach((u) => URL.revokeObjectURL(u));
  blobUrls = [];
  const parts = [];
  if (R.error) {
    parts.push(`<div class="run-err"><h3>${esc(R.title || 'Eroare la rulare')}</h3>${R.error.where ? `<pre>${esc(R.error.where)}</pre>` : ''}<pre class="last">${esc(R.error.last)}</pre>${R.hint ? `<p>${esc(R.hint)}</p>` : ''}</div>`);
  } else {
    const n = R.outputs.length;
    parts.push(`<div class="run-status ok">Rulat fără erori în ${(R.ms / 1000).toFixed(1).replace('.', ',')} s. ${n === 1 ? 'Un fișier creat' : `${n} fișiere create`}.</div>`);
  }
  const ids = Object.keys(R.checks || {});
  if (ids.length) {
    const rows = ids.map((id) => {
      const c = R.checks[id];
      const r = reqs.find((x) => x.id === id) || {};
      const pts = r.points ? `<span class="pts">${esc(r.points)}p</span>` : '';
      if (c.missing) return `<div class="chk no"><span class="mark">✗</span><b>${esc(id)}</b> <code>${esc(c.name)}</code> nu a fost creat.${pts}</div>`;
      const body = [`<tr class="${c.header.ok ? 'ok' : 'no'}"><td>antet</td><td><code>${esc(c.header.exp.join(','))}</code></td><td><code>${esc(c.header.got.join(','))}</code></td></tr>`,
        ...c.rows.map((x, i) => `<tr class="${x.ok ? 'ok' : 'no'}"><td>rândul ${i + 1}</td><td><code>${esc(x.exp.join(','))}</code></td><td><code>${esc((x.got || []).join(','))}</code>${x.note ? `<div class="note">${esc(x.note)}</div>` : ''}</td></tr>`)].join('');
      const label = c.ok ? 'se potrivește cu exemplul' : 'diferă de exemplu';
      let tip = '';
      if (!c.ok && r.type === 'medie_ponderata' && !r.params.inter) tip = 'Dacă exemplul a fost calculat din totaluri pe județe, alege „Totaluri întâi pe: Judet” la această cerință.';
      else if (!c.ok && !c.header.ok) tip = 'Antetul diferă: verifică numele coloanei calculate și numele indexului.';
      else if (!c.ok && c.rows.some((x) => /sortarea/.test(x.note))) tip = 'Valorile sunt bune, dar ordinea nu: verifică sortarea.';
      return `<details class="chk ${c.ok ? 'ok' : 'no'}"${c.ok ? '' : ' open'}><summary><span class="mark">${c.ok ? '✓' : '✗'}</span><b>${esc(id)}</b> <code>${esc(c.file)}</code> ${label}${pts}</summary><table class="cmp"><thead><tr><th></th><th>exemplul din enunț</th><th>rezultatul tău</th></tr></thead><tbody>${body}</tbody></table>${tip ? `<p class="note">${esc(tip)}</p>` : ''}</details>`;
    }).join('');
    parts.push(`<div class="run-block"><h3>Verificare cu exemplele din enunț</h3>${rows}</div>`);
  }
  if (R.outputs && R.outputs.length) {
    const outs = R.outputs.map((o) => {
      const { header, rows } = C.parseCSV(o.text);
      const url = URL.createObjectURL(new Blob([o.text], { type: 'text/csv;charset=utf-8' }));
      blobUrls.push(url);
      const head = `<tr>${header.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>`;
      const body = rows.slice(0, 10).map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('');
      return `<details class="out"><summary><code>${esc(o.name)}</code><span class="muted small">${rows.length} rânduri, ${header.length} coloane</span><a class="dl" href="${url}" download="${esc(o.name)}">descarcă</a></summary><div class="tbl"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>${rows.length > 10 ? `<p class="muted small">Primele 10 rânduri din ${rows.length}.</p>` : ''}</details>`;
    }).join('');
    parts.push(`<div class="run-block"><h3>Fișierele create</h3>${outs}</div>`);
  }
  if (R.figures && R.figures.length) parts.push(`<div class="run-block figs"><h3>Grafice</h3>${R.figures.map((b, i) => `<img alt="Graficul ${i + 1}" src="data:image/png;base64,${b}">`).join('')}</div>`);
  if (R.stdout && R.stdout.trim()) parts.push(`<details class="run-block stdout"><summary>Ce a afișat programul (print)</summary><pre>${esc(R.stdout)}</pre></details>`);
  return parts.join('');
}

function renderRun() {
  const el = $('#run');
  const R = S.run;
  if (!R) { el.innerHTML = ''; return; }
  if (R.busy) { el.innerHTML = `<div class="run-status"><span class="spinner"></span><span id="runStatus">${esc(R.status)}</span></div>`; return; }
  el.innerHTML = runHTML(R, S.reqs);
}

function renderChecks() {
  const checks = (S.run && S.run.checks) || {};
  for (const el of $$('.req-check')) {
    const c = checks[el.dataset.check];
    el.innerHTML = c ? `<span class="mark ${c.ok ? 'ok' : 'no'}" title="${c.ok ? 'Se potrivește cu exemplul' : 'Diferă de exemplu'}">${c.ok ? '✓' : '✗'}</span>` : '';
  }
}

async function run() {
  const btn = $('#runBtn');
  if (btn.disabled) return;
  if (!S.ctx || !S.ctx.main) {
    S.run = { title: 'Nimic de rulat', error: { last: 'Lipește mai întâi subiectul sau încarcă fișierele CSV.', where: '' } };
    renderRun();
    return;
  }
  const code = allCode();
  const reads = [...new Set([...Object.values(code).join('\n').matchAll(/read_csv\(\s*["']([^"']+)["']/g)].map((m) => m[1].split('/').pop()))];
  const missing = reads.filter((n) => !S.uploads.some((u) => u.name === n));
  if (missing.length) {
    S.run = { title: 'Lipsesc fișiere', error: { last: `Ca să rulez codul am nevoie de: ${missing.join(', ')}.`, where: '' }, hint: 'Încarcă fișierele CSV de la test în secțiunea „Fișierele CSV”. Numele trebuie să fie exact cele din cod.' };
    renderRun();
    $('#run').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }
  btn.disabled = true;
  S.run = { busy: true, status: 'Pornesc…' };
  renderRun();
  try {
    const res = await runPython(
      { files: S.uploads.map((u) => ({ name: u.name, text: u.text })), code, dirIn: S.settings.dirIn, dirOut: S.settings.dirOut },
      (st) => { if (S.run && S.run.busy) { S.run.status = st; const el = $('#runStatus'); if (el) el.textContent = st; } },
    );
    if (res.error) res.hint = hintFor(res.error.last);
    res.checks = checksFor(S.reqs, res.outputs);
    S.run = res;
  } catch (e) {
    S.run = { error: { last: String((e && e.message) || e), where: '' }, hint: 'Pentru rulare e nevoie de internet: Python pentru browser se descarcă la prima rulare.' };
  }
  btn.disabled = false;
  renderRun();
  renderChecks();
}
$('#runBtn').addEventListener('click', run);
$('#runBtn').title = 'Rulează (Ctrl+Enter)';
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !$('#view-rezolva').hidden) { e.preventDefault(); run(); }
});

// ───────────── subiect + exemple ─────────────
function markPreset() { $$('#presets [data-preset]').forEach((b) => b.classList.toggle('on', b.dataset.preset === S.preset)); }
async function loadPreset(id) {
  const P = PRESETS.find((p) => p.id === id);
  if (!P) return;
  S.preset = id;
  markPreset();
  S.text = P.text;
  $('#problem').value = P.text;
  try {
    S.uploads = await Promise.all(P.files.map(async (u) => {
      const res = await fetch(u);
      if (!res.ok) throw new Error(u);
      return C.fileFromCSV(u.split('/').pop(), await res.text());
    }));
  } catch {
    S.uploads = [];
  }
  S.settings.mainFile = '';
  analyze();
}
$('#presets').insertAdjacentHTML('beforeend', PRESETS.map((p) => `<button type="button" data-preset="${p.id}">${esc(p.label)}</button>`).join('') + '<button type="button" class="link" id="clearAll">Golește tot</button>');
$('#presets').addEventListener('click', (e) => {
  const b = e.target.closest('[data-preset]');
  if (b) { location.hash = 'rezolva'; loadPreset(b.dataset.preset); return; }
  if (e.target.closest('#clearAll')) {
    S.text = '';
    S.uploads = [];
    S.preset = null;
    S.settings.mainFile = '';
    $('#problem').value = '';
    markPreset();
    analyze();
    $('#problem').focus();
  }
});
$('#problem').addEventListener('input', debounce((e) => {
  S.text = e.target.value;
  S.autoText = false;
  S.notice = '';
  if (S.preset) { S.preset = null; markPreset(); }
  analyze();
}, 300));

// ───────────── setări ─────────────
for (const el of $$('[data-set]')) {
  const k = el.dataset.set;
  if (el.type === 'checkbox') el.checked = !!S.settings[k];
  else el.value = S.settings[k] ?? '';
  el.addEventListener(el.type === 'text' ? 'input' : 'change', debounce(() => {
    S.settings[k] = el.type === 'checkbox' ? el.checked : el.value;
    const { mainFile, ...persist } = S.settings;
    store.set('settings', persist);
    regen();
  }, 250));
}

// ───────────── Rezolvări ─────────────
const solCache = {};
function formatStatement(text) {
  let inEx = false;
  return text.split('\n').map((l) => {
    const s = l.trim();
    if (!s) { inEx = false; return ''; }
    if (/^exemplu\b/i.test(s)) { inEx = true; return `<p class="exlabel">${esc(s)}</p>`; }
    if (/^(\.{2,}|…)$/.test(s)) { inEx = false; return `<span class="exl">${esc(s)}</span>`; }
    const csv = s.includes(',') && !/\s(să|se|va|vor|și|în|de|la)\s/i.test(` ${s} `) && s.split(',').every((p) => p.trim().split(/\s+/).length <= 5);
    if (csv || (inEx && /^[\d.,\-\s]+$/.test(s))) { inEx = true; return `<span class="exl">${esc(s)}</span>`; }
    inEx = false;
    const m = s.match(/^(\d{1,2})\.\s+(.*)$/);
    if (m) return `<p class="req-line"><b>${m[1]}.</b> ${esc(m[2])}</p>`;
    return `<p>${esc(s)}</p>`;
  }).join('');
}

function renderSolutions() {
  const view = $('#view-rezolvari');
  if (!view.dataset.ready) {
    view.dataset.ready = '1';
    view.innerHTML = `<div class="sols"><nav class="sol-nav" aria-label="Rezolvări">${SOLUTIONS.map((s) => `<button type="button" data-sol="${s.id}"><b>${esc(s.title)}</b><span>${esc(s.sub)}</span></button>`).join('')}</nav><div class="sol-main" id="solMain"></div></div>`;
    $('.sol-nav', view).addEventListener('click', (e) => {
      const b = e.target.closest('[data-sol]');
      if (b) location.hash = `rezolvari/${b.dataset.sol}`;
    });
    $('#solMain').addEventListener('click', onSolClick);
  }
  openSolution(location.hash.split('/')[1] || SOLUTIONS[0].id);
}

async function openSolution(id) {
  const s = SOLUTIONS.find((x) => x.id === id) || SOLUTIONS[0];
  $$('.sol-nav [data-sol]').forEach((b) => b.classList.toggle('on', b.dataset.sol === s.id));
  if (!solCache[s.id]) {
    const pairs = await Promise.all(s.files.map(async (f) => {
      try { const r = await fetch(s.dir + f); return [f, r.ok ? await r.text() : `# nu am putut încărca ${f}`]; } catch { return [f, `# nu am putut încărca ${f}`]; }
    }));
    solCache[s.id] = Object.fromEntries(pairs);
  }
  const P = PRESETS.find((p) => p.id === s.preset);
  const main = $('#solMain');
  main.dataset.sol = s.id;
  main.dataset.file = s.files[0];
  main.innerHTML = `
    <section class="panel">
      <div class="sol-head">
        <div><h2>${esc(s.title)}</h2><p class="muted">${esc(s.sub)}</p></div>
        <div class="sol-actions">
          ${P ? '<button class="btn" type="button" data-act="open">Deschide în Rezolvă</button>' : ''}
          ${s.data ? '<button class="btn run" type="button" data-act="run"><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M4 2.5v11l9-5.5z"/></svg>Rulează rezolvarea</button>' : ''}
        </div>
      </div>
      ${P ? `<details class="statement"><summary>Enunțul</summary><div class="stmt">${formatStatement(P.text)}</div></details>` : ''}
    </section>
    <section class="ide sol-ide">
      <div class="ide-bar">
        <div class="ftabs">${s.files.map((f, i) => `<button class="ftab${i ? '' : ' on'}" type="button" data-solfile="${f}">${f}</button>`).join('')}</div>
        <div class="ide-actions"><button class="btn sm" type="button" data-act="copy">Copiază</button><button class="btn sm" type="button" data-act="dl">Descarcă</button></div>
      </div>
      <div class="ide-body"><pre class="gutter" aria-hidden="true"></pre><pre class="code"></pre></div>
    </section>
    <section class="panel">
      <h3>Cum funcționează</h3>
      <ol class="explain">${s.explain.map(([k, t]) => `<li>${k ? `<b>Cerința ${esc(k)}.</b> ` : ''}${t}</li>`).join('')}</ol>
      ${s.note ? `<p class="callout">${s.note}</p>` : ''}
    </section>
    <section class="run" id="solRun" aria-live="polite"></section>`;
  showSolFile(s.files[0]);
}

function showSolFile(f) {
  const main = $('#solMain');
  const code = (solCache[main.dataset.sol] || {})[f] || '';
  main.dataset.file = f;
  $$('[data-solfile]', main).forEach((b) => b.classList.toggle('on', b.dataset.solfile === f));
  const c = code.replace(/\n$/, '');
  $('.sol-ide .gutter', main).textContent = lineNums(c);
  $('.sol-ide .code', main).innerHTML = C.highlightPy(c);
}

async function onSolClick(e) {
  const main = $('#solMain');
  const s = SOLUTIONS.find((x) => x.id === main.dataset.sol);
  const tab = e.target.closest('[data-solfile]');
  if (tab) { showSolFile(tab.dataset.solfile); return; }
  const act = e.target.closest('[data-act]');
  if (!act || !s) return;
  const code = solCache[s.id][main.dataset.file] || '';
  if (act.dataset.act === 'copy') copyText(code, act);
  if (act.dataset.act === 'dl') download(main.dataset.file, code);
  if (act.dataset.act === 'open') { location.hash = 'rezolva'; loadPreset(s.preset); }
  if (act.dataset.act === 'run') runSolution(s, act);
}

async function runSolution(s, btn) {
  const out = $('#solRun');
  const P = PRESETS.find((p) => p.id === s.preset);
  btn.disabled = true;
  out.innerHTML = '<div class="run-status"><span class="spinner"></span><span id="solStatus">Pornesc…</span></div>';
  try {
    const files = await Promise.all(P.files.map(async (u) => ({ name: u.split('/').pop(), text: await (await fetch(u)).text() })));
    const res = await runPython({ files, code: solCache[s.id], dirIn: 'data_in/', dirOut: 'data_out/' }, (st) => { const el = $('#solStatus'); if (el) el.textContent = st; });
    if (res.error) res.hint = hintFor(res.error.last);
    const reqs = C.parseProblem(P.text).reqs.filter((r) => r.example).map((r) => ({ id: String(r.num), example: r.example, points: r.points, params: { out: r.outFile || `Cerinta${r.num}.csv` } }));
    res.checks = checksFor(reqs, res.outputs);
    out.innerHTML = runHTML(res, reqs);
  } catch (err) {
    out.innerHTML = `<div class="run-err"><h3>Nu am putut rula</h3><pre class="last">${esc((err && err.message) || err)}</pre></div>`;
  }
  btn.disabled = false;
}

// ───────────── Fițuică ─────────────
function renderCheat() {
  const view = $('#view-fituica');
  if (view.dataset.ready) return;
  view.dataset.ready = '1';
  const secs = CHEAT.map((sec) => `<section class="csec"><h2>${esc(sec.title)}</h2>${sec.items.map((it) => `<div class="citem" data-q="${esc(C.norm(`${sec.title} ${it.t} ${it.code} ${it.note || ''}`))}"><h3>${esc(it.t)}</h3><div class="snip"><pre>${C.highlightPy(it.code)}</pre><button class="cp" type="button">Copiază</button></div>${it.note ? `<p>${esc(it.note)}</p>` : ''}</div>`).join('')}</section>`).join('');
  view.innerHTML = `<div class="cheat"><div class="cheat-head"><h1>Fițuica pandas</h1><input type="search" id="cheatQ" placeholder="Caută: merge, groupby, procente, idxmax…" aria-label="Caută în fițuică"></div><div class="cheat-grid">${secs}</div><p class="cheat-empty" id="cheatEmpty" hidden>Nu am găsit nimic. Încearcă alt cuvânt.</p></div>`;
  $('#cheatQ').addEventListener('input', (e) => {
    const q = C.norm(e.target.value).trim();
    let any = false;
    for (const sec of $$('.csec', view)) {
      let n = 0;
      for (const it of $$('.citem', sec)) { const show = !q || it.dataset.q.includes(q); it.hidden = !show; if (show) n++; }
      sec.hidden = !n;
      if (n) any = true;
    }
    $('#cheatEmpty').hidden = any;
  });
  view.addEventListener('click', (e) => {
    const b = e.target.closest('.cp');
    if (b) copyText(b.previousElementSibling.textContent, b);
  });
}

// ───────────── legătura cu PyCharm (pluginul DSAD) ─────────────
// Pluginul deschide site-ul cu ?ide=1 și injectează window.dsadIDE.call(comanda, câmpuri) -> Promise.
const ideStatus = (msg) => { $('#ideStatus').textContent = msg; };
function syncSettingsInputs() {
  for (const el of $$('[data-set]')) {
    const k = el.dataset.set;
    if (el.type === 'checkbox') el.checked = !!S.settings[k];
    else el.value = S.settings[k] ?? '';
  }
}
async function ideSync() {
  if (!window.dsadIDE) return;
  ideStatus('Citesc fișierele din proiect…');
  let info;
  try { info = await window.dsadIDE.call('projectInfo'); } catch (e) { info = { ok: false, msg: String(e) }; }
  if (!info || !info.ok) { ideStatus((info && info.msg) || 'Nu pot citi proiectul.'); return; }
  S.uploads = (info.files || []).map((f) => C.fileFromCSV(f.name, f.text));
  S.settings.dirIn = info.dirIn || '';
  syncSettingsInputs();
  let from = '';
  S.notice = '';
  if (info.pdf && (!S.text.trim() || S.autoText)) {
    try {
      const bytes = Uint8Array.from(atob(info.pdf.b64), (c) => c.charCodeAt(0));
      const text = await pdfToText(bytes);
      if (text.trim()) { S.text = text; S.autoText = true; $('#problem').value = text; from = info.pdf.name; }
      else S.notice = `Nu am găsit text în ${info.pdf.name}. Lipește subiectul de mână.`;
    } catch (e) {
      S.notice = `Nu am putut citi ${info.pdf.name}: ${(e && e.message) || e}`;
    }
  }
  S.preset = null;
  markPreset();
  S.settings.mainFile = '';
  analyze();
  const n = S.uploads.length;
  const files = n ? `${n === 1 ? 'un fișier CSV' : `${n} fișiere CSV`} în ${info.dirIn || 'folderul proiectului'}` : 'niciun fișier CSV';
  const subj = from ? `, subiectul din ${from}` : S.text.trim() ? '' : '. Pune PDF-ul subiectului în proiect sau lipește textul mai jos';
  ideStatus(`${info.project}: ${files}${subj}.`);
}
async function ideWrite() {
  if (!window.dsadIDE || !S.gen || !S.ctx || !S.ctx.main) { ideStatus('Nu am încă cod de scris: lipește subiectul sau pune fișierele în proiect.'); return; }
  const btn = $('#ideWrite');
  btn.disabled = true;
  ideStatus('Scriu fișierele în proiect…');
  const fields = { run: '1', dirOut: S.settings.dirOut || '' };
  for (const [n, c] of Object.entries(allCode())) fields['file:' + n] = c;
  let res;
  try { res = await window.dsadIDE.call('writeFiles', fields); } catch (e) { res = { ok: false, msg: String(e) }; }
  btn.disabled = false;
  ideStatus(res.msg || (res.ok ? 'Gata.' : 'Nu am putut scrie fișierele.'));
  if (res.ok && S.uploads.length) run(); // verificarea cu exemplele, aici în panou
}
let ideConnected = false;
function ideConnect() {
  if (ideConnected || !window.dsadIDE) return;
  ideConnected = true;
  $('#ideBar').hidden = false;
  ideSync();
}
$('#ideWrite').addEventListener('click', ideWrite);
$('#ideReload').addEventListener('click', () => ideSync());
window.addEventListener('dsad-ide-ready', ideConnect);

// ───────────── pornire ─────────────
route();
if (IDE) {
  $('#ideBar').hidden = false;
  analyze();
  ideConnect();
  setTimeout(() => { if (!ideConnected) ideStatus('Nu sunt conectat la PyCharm. Închide și redeschide panoul DSAD.'); }, 5000);
} else {
  const draft = store.get('draft', null);
  if (draft && draft.preset) loadPreset(draft.preset);
  else {
    S.text = (draft && draft.text) || '';
    $('#problem').value = S.text;
    analyze();
  }
}
