/* dsad.py — logica site-ului: citire CSV, analiza subiectului, generare cod pandas.
   Nu atinge DOM-ul, ca să poată fi testată separat. */

// ───────────────────────── utilitare ─────────────────────────
export const norm = (s) => String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const pyStr = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
export const pyList = (a) => '[' + a.map(pyStr).join(', ') + ']';
export const isNumStr = (v) => { const t = String(v ?? '').trim(); return t !== '' && !isNaN(Number(t)); };
const keyNorm = (v) => { const t = String(v ?? '').trim(); return isNumStr(t) ? String(Number(t)) : t; };
export const fkey = (n) => norm(n).replace(/\.csv$/, '').replace(/[^a-z0-9]/g, '');
const uniq = (a) => [...new Set(a)];
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

// ───────────────────────── CSV ─────────────────────────
export function parseCSV(text) {
  text = String(text ?? '');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const nl = text.indexOf('\n');
  const first = nl < 0 ? text : text.slice(0, nl);
  const cnt = (ch) => first.split(ch).length - 1;
  const delim = cnt(';') > cnt(',') ? ';' : cnt('\t') > cnt(',') ? '\t' : ',';
  const rows = [];
  let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  const header = rows.shift() || [];
  return { delim, header, rows: rows.filter((r) => !(r.length === 1 && r[0].trim() === '')) };
}

export function fileFromCSV(name, text) {
  const { delim, header, rows } = parseCSV(text);
  const types = header.map((h, j) => {
    let n = 0, num = 0, empty = 0;
    for (const r of rows) {
      const v = (r[j] ?? '').trim();
      if (v === '') { empty++; continue; }
      n++; if (isNumStr(v)) num++;
    }
    return { numeric: n > 0 && num / n >= 0.95, hasNaN: empty > 0 };
  });
  const firsts = rows.map((r) => keyNorm(r[0]));
  return { name, text, source: 'upload', delim, header, rows, types, firstUnique: new Set(firsts).size === firsts.length, nRows: rows.length };
}

const TEXTY = /^(den|nume|name|localit|judet|county|city|oras|regiun|region|indicativ|country|countries|tara|tari|continent|macro|sex|mediu|categor|tip|um\b|cod_?tara|iso|activitat|code$)/i;
function virtualFile(name, header, source) {
  const types = header.map((h, j) => ({ numeric: j > 0 && !TEXTY.test(h.trim()), hasNaN: false }));
  return { name, source, delim: ',', header, rows: null, types, firstUnique: true, nRows: 0 };
}

// Fișiere „standard” folosite des la DSAD (folosite când nu sunt încărcate)
export const REGISTRY = {
  populatielocalitati: ['Siruta', 'Localitate', 'Judet', 'Populatie'],
  codurijudete: ['IndicativJudet', 'NumeJudet', 'Regiune'],
  coduriregiuni: ['Regiune', 'MacroRegiune'],
  codurilocalitati: ['Code', 'City', 'County'],
};

const VALCACHE = new WeakMap();
export function colValues(f, col) {
  if (!f || !f.rows) return null;
  let m = VALCACHE.get(f.rows);
  if (!m) { m = new Map(); VALCACHE.set(f.rows, m); }
  if (!m.has(col)) {
    const j = f.header.indexOf(col);
    m.set(col, j < 0 ? null : new Set(f.rows.map((r) => keyNorm(r[j])).filter((v) => v !== '')));
  }
  return m.get(col);
}

export function findFile(files, name) {
  const k = fkey(name);
  return files.find((f) => fkey(f.name) === k)
    || files.find((f) => lev(fkey(f.name), k) <= 2)
    || files.find((f) => fkey(f.name).includes(k) || k.includes(fkey(f.name)))
    || null;
}

// ───────────────────────── textul subiectului ─────────────────────────
const CSVNAME = /([A-Za-z_][\w\-]*\.csv)\b/gi;
const STOP_LINE = /^\s*(\d+\s*punct\w*\s+din\s+oficiu|observa[tțţ]i[ea]?\b|nota\s*:)/i;
const ELLIPSIS = /^\s*(\.{2,}|…+)\s*$/;

function csvLike(l) {
  const s = l.trim();
  if (!s.includes(',') || s.length > 600) return false;
  if (/\b(sa|se|va|vor|pentru|fiecare|care|este|sunt)\b/.test(norm(s))) return false;
  return s.split(',').every((p) => p.trim().split(/\s+/).length <= 5 && p.length <= 60);
}

// lipește două bucăți de rând rupte de PDF („…,F” + „ermeMixte,…”)
function glue(a, b, known) {
  if (/,$/.test(a) || /^,/.test(b)) return a + b;
  const tail = a.split(',').pop().trim();
  const head = b.split(',')[0].trim();
  if (known.includes(tail + head)) return a + b;
  if (known.includes(`${tail} ${head}`)) return `${a} ${b}`;
  if (/[a-z]$/.test(a) && /^[A-Z]/.test(b)) return `${a} ${b}`;
  return a + b;
}

function joinExample(lines, known = []) {
  const L = lines.map((l) => l.trim()).filter(Boolean);
  const cnt = (s) => s.split(',').length;
  let R = 0;
  for (const l of L.slice(1)) R = Math.max(R, cnt(l));
  // antetul poate fi și el rupt pe mai multe rânduri
  let headLine = L[0];
  let start = 1;
  while (start < L.length && cnt(headLine) < R && cnt(glue(headLine, L[start], known)) <= R) {
    headLine = glue(headLine, L[start], known);
    start++;
  }
  const header = headLine.split(',').map((s) => s.trim());
  const H = header.length;
  const rows = [];
  let cur = '';
  for (const l of L.slice(start)) {
    const s = l.trim();
    if (!s) continue;
    if (!cur) cur = s;
    else if (/,$/.test(cur) || /^,/.test(s) || (/\d$/.test(cur) && /^\d/.test(s))) cur += s;
    else cur += ' ' + s;
    if (cur.split(',').length >= H) { rows.push(cur.split(',').map((x) => x.trim())); cur = ''; }
  }
  if (cur) rows.push(cur.split(',').map((x) => x.trim()));
  return { header, rows };
}

function parseBlock(num, blines, files, known = []) {
  let exStart = -1, labelAt = -1;
  for (let i = 0; i < blines.length; i++) {
    if (/^\s*exemplu\b/i.test(blines[i])) { labelAt = i; exStart = i + 1; break; }
    if (i > 0 && csvLike(blines[i])) { exStart = i; break; }
  }
  const descLines = exStart < 0 ? blines : blines.slice(0, labelAt >= 0 ? labelAt : exStart);
  let desc = descLines.join(' ').replace(/\s+/g, ' ').trim();
  const pm = desc.match(/\(\s*(\d+(?:[.,]\d+)?)\s*punct\w*\s*\)/i);
  const points = pm ? pm[1].replace(',', '.') : '';
  desc = desc.replace(/\(\s*\d+(?:[.,]\d+)?\s*punct\w*\s*\)/gi, '').trim();
  let example = null;
  if (exStart >= 0) {
    const ex = [];
    const sameLine = labelAt >= 0 ? blines[labelAt].replace(/^\s*exemplu\s*:?\s*/i, '') : '';
    if (sameLine.trim()) ex.push(sameLine);
    for (let i = exStart; i < blines.length; i++) {
      const l = blines[i];
      if (!l.trim()) continue;
      if (ELLIPSIS.test(l)) break;
      if (!ex.length) {
        if (csvLike(l) || /^[\w ./%-]+$/.test(l.trim())) { ex.push(l); continue; }
        break;
      }
      if (csvLike(l) || /^[\d.,eE+\-\s]+$/.test(l.trim())) ex.push(l); else break;
    }
    if (ex.length) example = joinExample(ex, known);
  }
  const outs = [...desc.matchAll(CSVNAME)].map((m) => m[1])
    .filter((n) => !files.some((f) => fkey(f) === fkey(n) || lev(fkey(f), fkey(n)) <= 2));
  return { num, desc, points, example, outFile: outs[0] || '' };
}

export function parseProblem(raw) {
  let text = String(raw ?? '').replace(/\r/g, '').replace(/ /g, ' ').replace(/[‘’]/g, "'").replace(/[“”„]/g, '"');
  const reqRe = /^\s*(?:cerin[tțţ]a\s*)?(\d{1,2})\s*[.)]\s*(?=[A-Za-zĂÂÎȘȚăâîșțŞŢşţ"(])/;
  const findStarts = (lines, cer) => {
    const st = [];
    for (let i = Math.max(0, cer); i < lines.length; i++) {
      const m = lines[i].match(reqRe);
      if (!m) continue;
      const num = +m[1];
      const expected = st.length ? st[st.length - 1].num + 1 : null;
      if (expected === null ? (cer >= 0 || num === 1) : num === expected) st.push({ i, num, cut: m[0].length });
    }
    return st;
  };
  let lines = text.split('\n');
  let cer = lines.findIndex((l) => /^\s*cerin[tțţ]e\b/i.test(l));
  let starts = findStarts(lines, cer);
  if (!starts.length && text.trim()) {
    // text lipit pe un singur rând: refac rândurile
    text = text.replace(/\s(?=(?:\d{1,2})\.\s+[A-ZĂÂÎȘȚ])/g, '\n').replace(/\s(?=Exemplu\b)/g, '\n').replace(/(Cerin[tțţ]e[^\n.:]*:?)/i, '\n$1\n');
    lines = text.split('\n');
    cer = lines.findIndex((l) => /^\s*cerin[tțţ]e\b/i.test(l));
    starts = findStarts(lines, cer);
  }
  const introEnd = cer >= 0 ? cer : starts.length ? starts[0].i : lines.length;
  const intro = lines.slice(0, introEnd).join('\n');
  const flat = intro.replace(/\s*\n\s*/g, ' ');
  const files = [];
  for (const m of flat.matchAll(CSVNAME)) if (!files.some((f) => fkey(f) === fkey(m[1]))) files.push(m[1]);
  let mainPart = flat;
  if (files.length > 1) { const k = flat.toLowerCase().indexOf(files[1].toLowerCase()); if (k > 0) mainPart = flat.slice(0, k); }
  const mainCols = [];
  for (const m of mainPart.matchAll(/(?:^|[;:.]\s*|\s)((?:[A-Za-z_]\w*\s*,\s*)*[A-Za-z_]\w*)\s+[-–—]\s+/g)) {
    for (const c of m[1].split(',')) { const n = c.trim(); if (n && !mainCols.includes(n) && !/\.csv$/i.test(n)) mainCols.push(n); }
  }
  const reqs = starts.map((s, k) => {
    const end = k + 1 < starts.length ? starts[k + 1].i : lines.length;
    const block = lines.slice(s.i, end);
    block[0] = block[0].slice(s.cut);
    if (k === starts.length - 1) { const st = block.findIndex((l, j) => j > 0 && STOP_LINE.test(l)); if (st > 0) block.length = st; }
    return parseBlock(s.num, block, files, mainCols);
  });
  return { intro, files, mainCols, reqs };
}

// ───────────────────────── context (fișiere + coloane) ─────────────────────────
function varNameFor(name) {
  const base = name.replace(/\.csv$/i, '');
  const k = fkey(base);
  if (/^populatie/.test(k)) return 'df_populatie';
  if (/^coduri?judet/.test(k)) return 'df_coduri';
  if (/^coduri?regiun/.test(k)) return 'df_coduri_reg';
  if (/^coduri?localit/.test(k)) return 'df_coduri_loc';
  const words = base.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => norm(w));
  let s = words.join('_');
  if (words.length > 1 && s.length > 15) s = words[0] + '_' + words.slice(1).map((w) => w[0]).join('');
  return 'df_' + (s || 'date');
}

export function buildContext(problem, uploads, settings = {}) {
  const files = uploads.map((u) => ({ ...u }));
  for (const n of problem.files) {
    if (findFile(files, n)) continue;
    const reg = REGISTRY[fkey(n)];
    if (reg) files.push(virtualFile(n, reg, 'standard'));
    else if (fkey(n) === fkey(problem.files[0]) && problem.mainCols.length >= 2) files.push(virtualFile(n, problem.mainCols, 'text'));
    else files.push(virtualFile(n, [], 'lipsa'));
  }
  let main = null;
  let missingMain = '';
  if (settings.mainFile) main = findFile(files, settings.mainFile);
  if ((!main || !main.header.length) && problem.files.length) {
    main = findFile(files, problem.files[0]);
    if (main && !main.header.length) { missingMain = problem.files[0]; main = null; }
  }
  if (!main && !missingMain) {
    const cands = files.filter((f) => f.header.length && f.source === 'upload');
    const nNum = (f) => f.types.filter((t) => t.numeric).length;
    main = cands.sort((a, b) => nNum(b) - nNum(a))[0] || null;
  }
  const used = new Set();
  for (const f of files) {
    f.indexCol = f.firstUnique ? 0 : null;
    let v = varNameFor(f.name), i = 2;
    while (used.has(v)) v = varNameFor(f.name) + i++;
    used.add(v); f.varName = v;
  }
  const ctx = { files, main, problem, settings, missingMain };
  if (!main || !main.header.length) { ctx.main = null; return ctx; }

  const idx = main.indexCol === 0 ? main.header[0] : null;
  const cols = main.header.filter((h, j) => !(main.indexCol === 0 && j === 0));
  const typeOf = (h) => main.types[main.header.indexOf(h)] || { numeric: false };
  const nameCol = cols.find((c) => !typeOf(c).numeric) || null;
  const vars = cols.filter((c) => typeOf(c).numeric);
  let varsExpr = pyList(vars);
  if (vars.length) {
    const k = cols.indexOf(vars[0]);
    if (cols.slice(k).every((c) => vars.includes(c))) varsExpr = `list(${main.varName}.columns.values)[${k}:]`;
  }
  const T = norm(problem.intro + ' ' + problem.reqs.map((r) => r.desc).join(' '));
  const varsName = /etni/.test(T) ? 'etnii' : /activitat(i|ile|ilor)\b/.test(T) ? 'activitati' : /indicator/.test(T) ? 'indicatori' : 'variabile';
  const allCols = [];
  for (const f of [main, ...files.filter((x) => x !== main)]) {
    f.header.forEach((h, j) => {
      if (f.indexCol === 0 && j === 0) return;
      if (allCols.some((c) => c.name === h)) return;
      allCols.push({ name: h, file: f.name, numeric: !!(f.types[j] && f.types[j].numeric), inMain: f === main });
    });
  }
  const GROUPISH = /judet|county|regiun|region|macro|continent|^tara$|^country$|^an$|^ani$|zona|mediu|categor/i;
  const NAMEISH = /^(den|nume|name|localit|city|oras|denumire)/i;
  const groupCols = allCols
    .filter((c) => c.name !== nameCol && !NAMEISH.test(c.name) && (GROUPISH.test(c.name) || !c.numeric))
    .map((c) => c.name)
    .sort((a, b) => (GROUPISH.test(b) ? 1 : 0) - (GROUPISH.test(a) ? 1 : 0));
  Object.assign(ctx, {
    idx, cols, nameCol, vars, varsExpr, varsName, allCols, groupCols,
    mainVar: main.varName, locVar: main.varName + '_loc',
    hasNaN: main.types.some((t) => t.hasNaN),
  });
  return ctx;
}

// ───────────────────────── recunoașterea cerințelor ─────────────────────────
const RX = {
  nan: /valori(le)?\s+lipsa|valorile\s+nule|inlocui\w*\s+(a\s+)?valori/,
  pivot: /pivot|pe\s+linii\b.*\bpe\s+coloane|pe\s+coloane\b.*\bpe\s+linii/,
  cov: /covarian/, corr: /corelati|matric\w*\s+de\s+corela/, std: /standardiz/,
  acp: /componente(lor)?\s+principale|\bacp\b|corelati\w*\s+factorial|\bscoruri|cosinus|contributi|comunalitat|varianta\s+componentelor/,
  disim: /disimilaritat/, shannon: /shannon/, lq: /de\s+localizare/,
  cv: /coeficient\w*\s+de\s+variati/, wmean: /medi\w*\s+ponderat/,
  top: /\b(primele|primii|top)\s+(\d+)/,
  pct: /\bprocent|structur|pondere\w*\s+(fiecare|fiecarei|fiecarui|pe\s+fiecare)/,
  ext: /\b(cel|cea|cei|cele)\s+mai\s+(mare|mari|mic|mici|mult|multi|multe|putin|putini|putine|ridicat\w*|scazut\w*|redus\w*|numeros\w*|bogat\w*|sarac\w*|populat\w*|dezvoltat\w*)\b|\bmaxim\w*|\bminim\w*|\bdominant\w*|\bmajoritar\w*|\bpredominant\w*/,
  minw: /\b(cel|cea|cei|cele)\s+mai\s+(mic|mici|putin|putini|putine|scazut\w*|redus\w*|sarac\w*)|\bminim/,
  mean: /\bmedi(a|e|ile|ilor)\b|\bmediu\b|valo\w*\s+medi/,
  ratio: /\brat(a|ei|ele)\b|raport|\bpondere|\bpe\s+locuitor|la\s+\d+\s+(de\s+)?locuitori|per\s+capita|densitat|productivitat/,
  sum: /\b(suma|sumele|total|totalul|totalurile)\b|populati\w*\s+pe\s/,
  filt: /mai\s+(mare|mic|mari|mici)\s+(decat|ca)\b|peste\s+medi|sub\s+medi|unde\s+exist|in\s+care\s+exist|(diferit|diferite)\s+de\s+0|nenul|cu\s+valori\s+(peste|sub)/,
};

const GROUP_DEF = [
  { w: /^macro-?regiun/, col: /macro/i },
  { w: /^regiun/, col: /^regiun|^region/i },
  { w: /^judet/, col: /^judet|^county|^indicativ_?judet|^jud$|^cod_?judet/i },
  { w: /^continent/, col: /continent/i },
  { w: /^(tara|tari|tarii|tarilor|statelor)$/, col: /^tara|^country|^tari$|^stat/i },
  { w: /^(localitat|oras|orase|comun|municip|uat)/, row: true },
];

function resolveGroupCol(def, ctx) {
  const all = [...(ctx.idx ? [ctx.idx] : []), ...ctx.allCols.map((c) => c.name)];
  const hit = all.find((c) => def.col.test(c));
  if (!hit) return null;
  if (hit === ctx.idx || hit === ctx.nameCol) return '__rand__';
  return hit;
}

export function detectGroups(t, ctx) {
  const out = [];
  const addDef = (def) => {
    const col = def.row ? '__rand__' : resolveGroupCol(def, ctx);
    if (col && !out.includes(col)) out.push(col);
  };
  const trig = /(?:la\s+nivel(?:ul)?(?:\s+(?:de|al))?|pentru\s+fiecare|pe\s+fiecare|din\s+fiecare|in\s+fiecare|in\s+cadrul\s+fiecar\w*|per|pe)\s+/g;
  let m;
  while ((m = trig.exec(t))) {
    const rest = t.slice(m.index + m[0].length).split(/\s+/).slice(0, 10);
    let expect = true;
    for (const raw of rest) {
      const w = raw.replace(/[^a-z-]/g, '');
      if (!w) continue;
      if (w === 'si') { expect = true; continue; }
      if (!expect) break;
      const def = GROUP_DEF.find((d) => d.w.test(w));
      if (!def) break;
      addDef(def);
      expect = /,$/.test(raw);
    }
  }
  if (!out.some((g) => g !== '__rand__')) {
    if (/\bjudetel(e|or)\b/.test(t)) addDef(GROUP_DEF[2]);
    else if (/\bregiunil(e|or)\b/.test(t)) addDef(GROUP_DEF[1]);
    else if (/\bcontinentel(e|or)\b/.test(t)) addDef(GROUP_DEF[3]);
  }
  return out;
}

const CONCEPTS = [
  [/cifr\w*\s+de\s+afaceri|\bca\b/, /cifr|afacer|^ca$|turnover/i],
  [/salariat|angajat|personal|lucrator/, /sal|angaj|employ|personal|lucrat/i],
  [/firm|intreprinder|societat|compani/, /firm|intrep|societ|compan/i],
  [/profit/, /profit/i],
  [/pierder/, /pierd|loss/i],
  [/populati|locuitor/, /popul|locuit/i],
  [/suprafat/, /suprafat|area/i],
  [/nascut|natalitat|nasteri/, /nasc|natal|naster|birth/i],
  [/deces|mortalitat|decedat/, /dece|mortal|death/i],
  [/venit/, /venit|income/i],
  [/export/, /export/i], [/import/, /import/i],
  [/emisi/, /emis/i], [/vot|alegator/, /vot|alegat/i],
];
const STOPW = new Set('de la si in pe a al ale cu din pentru nivel nivelul fiecare total totala totalul numarul numar valoarea valorile cel cea cei cele mai mare mari'.split(' '));
const TOKMAP = { nr: 'numar', sal: 'salariati', pop: 'populatie', ca: 'cifra' };
function colTokens(c) {
  return String(c).replace(/([a-z])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).map(norm).filter(Boolean).map((t) => TOKMAP[t] || t);
}
export function scoreCol(phrase, col) {
  const p = norm(phrase).trim();
  if (!p) return 0;
  if (norm(col).replace(/[^a-z0-9]/g, '') === p.replace(/[^a-z0-9]/g, '')) return 20;
  let s = 0;
  const nc = norm(col).replace(/[^a-z0-9]/g, '');
  if (/\d/.test(nc) && nc.length >= 3 && new RegExp(`(^|[^a-z0-9])${nc}([^a-z0-9]|$)`).test(p)) s += 10;
  for (const [pr, cr] of CONCEPTS) if (pr.test(p) && cr.test(col)) s += 4;
  const words = p.split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOPW.has(w));
  const toks = colTokens(col);
  for (const w of words) {
    for (const t of toks) {
      if (t.length < 3) continue;
      if (w.slice(0, 5) === t.slice(0, 5) || (w.length >= 4 && t.startsWith(w.slice(0, 4))) || (t.length >= 4 && w.startsWith(t.slice(0, 4))) || w.startsWith(t)) { s += 1; break; }
    }
  }
  return s;
}
function matchCol(phrase, cands) {
  let best = null, bs = 0;
  for (const c of cands) { const s = scoreCol(phrase, c); if (s > bs) { bs = s; best = c; } }
  return bs >= 1 ? best : null;
}
const popCol = (ctx) => (ctx.allCols.find((c) => /popul|locuit/i.test(c.name)) || {}).name || '';
const numCands = (ctx) => ctx.allCols.filter((c) => c.numeric).map((c) => c.name);

function parseRatio(t, ctx) {
  const pop = popCol(ctx);
  const cands = numCands(ctx);
  let m, A = null, B = null, k = '1';
  if ((m = t.match(/raport\w*\s+(?:dintre\s+)?(.+?)\s+(?:si|la|\/)\s+(.+?)(?=\s+(?:pentru|la\s+nivel|unde|in\s+care|din\s+fiecare|pe\s+fiecare|si\s+sa|datele|se\s+va)\b|[,.;(]|$)/))) {
    A = m[1]; B = m[2];
  } else if ((m = t.match(/(\w+(?:\s+\w+){0,3}?)\s+la\s+(\d+)\s+(?:de\s+)?locuitori/))) {
    A = m[1]; B = '__pop__'; k = m[2];
  } else if ((m = t.match(/(\w+(?:\s+\w+){0,3}?)\s+(?:pe|per)\s+(?:locuitor|cap\s+de\s+locuitor|capita)/))) {
    A = m[1]; B = '__pop__';
  } else if ((m = t.match(/ponderea\s+(.+?)\s+(?:in|din)\s+(?:totalul\s+)?(populati\w*)/))) {
    A = m[1]; B = '__pop__';
  }
  const Acol = A ? matchCol(A, cands) : null;
  let Bcol = B === '__pop__' ? pop : B ? matchCol(B, cands) : null;
  if (!Bcol && /locuitor|populati/.test(t)) Bcol = pop;
  if (Bcol === Acol) Bcol = pop;
  return { A: Acol || (ctx.vars.length > 1 ? '__total__' : ctx.vars[0] || ''), B: Bcol || '', k, found: !!(A || B) };
}

const ROW_ENT = /^(localitat|oras|comun|municip|tara|tari|tarii|statul|statele|judet|regiun|firm|compani|uat)/;
const COL_ENT = /^(activitat|anul|anii|etni|categori|indicator|ramur|sector|tip|grup|varst|lun|produs|cultur|domeni|ocupati|industri|specializar|limb|religi|nationalitat|cauz|boal|variabil|component)/;
function entityBefore(t, at) {
  const words = t.slice(0, at).split(/[^a-z]+/).filter(Boolean).slice(-6).reverse();
  for (const w of words) {
    if (COL_ENT.test(w)) return { kind: 'col', word: w };
    if (ROW_ENT.test(w)) return { kind: 'row', word: w };
  }
  return null;
}
const ENT_NAME = (w) => {
  const map = [[/^localitat/, 'Localitate'], [/^oras/, 'Oras'], [/^tar/, 'Tara'], [/^judet/, 'Judet'], [/^regiun/, 'Regiune'], [/^activitat/, 'Activitate'], [/^an/, 'Anul'], [/^etni/, 'Etnie'], [/^indicator/, 'Indicator'], [/^categori/, 'Categorie'], [/^firm/, 'Firma']];
  for (const [re, n] of map) if (re.test(w)) return n;
  return cap(w);
};

function detectRound(ex) {
  if (!ex || !ex.rows.length) return '';
  let maxDec = -1, long = false;
  for (const row of ex.rows) for (const v of row.slice(1)) {
    const m = String(v).trim().match(/^-?\d+\.(\d+)$/);
    if (!m || /^0+$/.test(m[1])) continue;
    if (m[1].length >= 7) long = true;
    maxDec = Math.max(maxDec, m[1].length);
  }
  return !long && maxDec >= 1 && maxDec <= 4 ? String(maxDec) : '';
}

function acpParts(t) {
  const P = [];
  if (/varianta/.test(t)) P.push('varianta');
  if (/corelati\w*\s+factorial|corelograma/.test(t)) P.push('corelatii');
  if (/scoruri/.test(t)) P.push('scoruri');
  if (/cosinus|calitatea\s+reprezentarii/.test(t)) P.push('cosinusuri');
  if (/contributi/.test(t)) P.push('contributii');
  if (/comunalitat/.test(t)) P.push('comunalitati');
  return P.length ? P : ['varianta', 'corelatii', 'scoruri', 'cosinusuri', 'contributii', 'comunalitati'];
}

const CMP = /mai\s+(mare|mic|mari|mici)\s+(decat|ca|de)\b|peste\s+medi|sub\s+medi|\bnegativ|\bpozitiv|[<>]=?\s*-?\d|diferit\w*\s+de\s+0|nenul/;

/** „Se va salva codul țării, numele și RS” -> coloanele existente care trebuie păstrate. */
function parseSaved(t, ctx) {
  const m = t.match(/(?:se\s+va\s+(?:salva|afisa)|vor\s+fi\s+salvate|se\s+vor\s+salva|se\s+salveaza)\s+(?:pentru\s+fiecare\s+\w+\s*,?\s*)?(.+?)(?:\.\s|\.$|$)/);
  if (!m) return null;
  const keep = [];
  for (const ph of m[1].split(/\s*,\s*|\s+si\s+/).map((s) => s.trim()).filter(Boolean)) {
    if (/\bcod/.test(ph)) continue;
    if (/\b(nume|numele|denumire)/.test(ph) && ctx.nameCol) { if (!keep.includes(ctx.nameCol)) keep.push(ctx.nameCol); continue; }
    const c = ctx.cols.find((x) => norm(x).replace(/[^a-z0-9]/g, '') === ph.replace(/[^a-z0-9]/g, '')) || matchCol(ph, ctx.cols);
    if (c && !keep.includes(c)) keep.push(c);
  }
  return keep.length ? keep : null;
}

/** Ce tip de cerință pare să fie (poate întoarce mai multe, ex. disimilaritate + Shannon). */
function classify(req, ctx) {
  const t = norm(req.desc);
  const groups = detectGroups(t, ctx);
  const g = groups.find((x) => x !== '__rand__');
  if (RX.acp.test(t)) return ['acp'];
  if (RX.pivot.test(t)) return ['pivot'];
  if (RX.cov.test(t) || RX.corr.test(t) || RX.std.test(t)) return ['cov_corr_std'];
  if (RX.disim.test(t) || RX.shannon.test(t)) return [...(RX.disim.test(t) ? ['disimilaritate'] : []), ...(RX.shannon.test(t) ? ['shannon'] : [])];
  if (RX.lq.test(t)) return ['localizare'];
  if (RX.cv.test(t)) return ['coef_variatie'];
  if (RX.wmean.test(t)) return ['medie_ponderata'];
  if (RX.nan.test(t)) return ['valori_lipsa'];
  if (RX.top.test(t)) return ['top_n'];
  const ex = t.match(RX.ext);
  if (ex) {
    const ent = entityBefore(t, ex.index);
    if (ent && ent.kind === 'col') return ['argmax_coloane'];
    if (g) return ['max_in_grup'];
    if (ent && ent.kind === 'row') return ['top_n'];
    return ['argmax_coloane'];
  }
  if (RX.pct.test(t)) return ['procente'];
  if (CMP.test(t) && !/raport|pe\s+locuitor|la\s+\d+\s+(de\s+)?locuitori/.test(t)) return ['filtru'];
  if (RX.ratio.test(t)) {
    if (g) return ['rata_grup'];
    if (/(pentru|pe)\s+fiecare\s+(activitat|indicator|variabil|etni|categori|an\b)|fiecarei\s+(activitat|etni|categori)|fiecarui\s+(indicator|an\b)/.test(t)) return ['indicator_variabile'];
    return ['indicator_rand'];
  }
  if (g && RX.mean.test(t)) return ['agregare'];
  if (g) return ['agregare'];
  if (RX.filt.test(t)) return ['filtru'];
  return ['custom'];
}

/** Parametrii pentru un tip anume, dedus din textul cerinței și exemplu. */
export function deriveParams(type, req, ctx, prev = []) {
  const t = norm(req.desc);
  const H = req.example ? req.example.header : [];
  const groups = detectGroups(t, ctx);
  const g = groups.find((x) => x !== '__rand__') || '';
  const T = TEMPLATES[type];
  const p = {
    ...T.defaults(ctx),
    out: req.outFile || `Cerinta${req.num}.csv`,
    sort: /descresc/.test(t) ? 'desc' : /crescat/.test(t) ? 'asc' : 'none',
    round: detectRound(req.example),
    indexName: '',
  };
  const allNames = ctx.allCols.map((c) => c.name);
  const hVars = H.slice(1).filter((c) => ctx.vars.includes(c));
  const idxFix = (grp) => (H[0] && grp && H[0] !== grp ? H[0] : '');
  const lastIsNew = H.length > 1 && !allNames.includes(H[H.length - 1]) && H[H.length - 1] !== ctx.idx;
  switch (type) {
    case 'filtru': {
      const mainNum = numCands(ctx).filter((c) => ctx.cols.includes(c));
      const paren = [...req.desc.matchAll(/\(([A-Za-z_]\w*)\)/g)].map((x) => x[1]).find((c) => mainNum.includes(c));
      const explicit = req.desc.match(/\b([A-Za-z_]\w*)\s*(<=|>=|<|>|==|!=)\s*(-?\d+(?:[.,]\d+)?)/);
      const sign = t.match(/(.{0,60}?)\s+(negativ\w*|pozitiv\w*)/);
      const m = t.match(/(.{0,60}?)\s+(?:este|sunt|e)?\s*(mai\s+(?:mare|mic|mari|mici)\s+(?:decat|ca|de)|peste|sub|diferit\w*\s+de)\s+(media|medie|[\d.,]+)/);
      if (explicit && ctx.cols.includes(explicit[1])) {
        Object.assign(p, { col: explicit[1], op: explicit[2], val: explicit[3].replace(',', '.') });
      } else if (sign) {
        const col = paren || matchCol(sign[1], mainNum);
        Object.assign(p, { col: col || (ctx.vars.length > 1 ? '__total__' : ctx.vars[0]), op: /negativ/.test(sign[2]) ? '<' : '>', val: '0' });
      } else if (m) {
        const op = /mare|peste/.test(m[2]) ? '>' : /mic|sub/.test(m[2]) ? '<' : '!=';
        const col = paren || matchCol(m[1], mainNum);
        const val = /medi/.test(m[3]) ? 'media' : m[3].replace(',', '.').replace(/\.$/, '');
        Object.assign(p, { col: col || (ctx.vars.length > 1 ? '__total__' : ctx.vars[0]), op, val });
      } else if (/unde\s+exist|in\s+care\s+exist/.test(t)) {
        const m2 = t.match(/(?:unde|in\s+care)\s+exist\w*\s+(\w+)/);
        const col = m2 ? matchCol(m2[1], numCands(ctx).filter((c) => ctx.cols.includes(c))) : null;
        Object.assign(p, { col: col || '__total__', op: '>', val: '0' });
      }
      const keep = H.length ? H.filter((c) => c !== ctx.idx && ctx.cols.includes(c)) : parseSaved(t, ctx) || [];
      if (keep.length && keep.length < ctx.cols.length) p.keep = keep;
      // „…și cifra de afaceri totală”: totalul calculat apare ca o coloană nouă
      if (p.col === '__total__') {
        if (H.length && lastIsNew) p.totalName = H[H.length - 1];
        else if (!H.length && /(se\s+va\s+(salva|afisa)|vor\s+fi\s+salvate)[^.]*\btotal/.test(t)) p.totalName = 'Total';
      }
      break;
    }
    case 'indicator_rand': {
      const r = parseRatio(t, ctx);
      Object.assign(p, { A: r.A, B: r.B, op: r.k !== '1' ? 'divk' : 'div', k: r.k !== '1' ? r.k : '1000' });
      if (/unde\s+exist|in\s+care\s+exist|diferit\w*\s+de\s+0|nenul|mai\s+mare\s+(decat|ca)\s+0/.test(t)) p.filt = true;
      if (H.length) {
        if (lastIsNew) p.name = H[H.length - 1];
        const keep = H.slice(0, lastIsNew ? -1 : undefined).filter((c) => c !== ctx.idx && allNames.includes(c));
        p.keep = keep;
        if (H[0] !== ctx.idx && ctx.idx) p.noIndex = true;
      } else p.name = /raport/.test(t) ? 'Raport' : 'Indicator';
      break;
    }
    case 'indicator_variabile': {
      const r = parseRatio(t, ctx);
      Object.assign(p, { B: r.B || popCol(ctx), k: r.k });
      if (hVars.length) p.vars = hVars;
      p.keepName = !!(ctx.nameCol && (!H.length || H.includes(ctx.nameCol)));
      break;
    }
    case 'procente': {
      const lv = groups.length ? groups : ['__rand__'];
      p.levels = lv;
      p.zero = /vor\s+fi\s+0|procentele\s+(vor\s+fi|sunt)\s+0|(fie|sa\s+fie)\s+0|egal\w*\s+cu\s+0/.test(t);
      if (hVars.length) p.vars = hVars;
      p.keepName = !!(ctx.nameCol && (!H.length || H.includes(ctx.nameCol)));
      if (/(din|in)\s+total\w*\s+(pe\s+)?(tara|national|judet)|pondere\w*\s+\w+\s+in\s+total/.test(t) && !/fiecare\s+(activitat|etni|categori)/.test(t)) p.axis = '0';
      break;
    }
    case 'agregare': {
      p.levels = groups.filter((x) => x !== '__rand__');
      if (!p.levels.length && ctx.groupCols.length) p.levels = [ctx.groupCols[0]];
      p.agg = /\bmedi(a|e|ile|ilor)\b|\bmediu\b|valo\w*\s+medi/.test(t) ? 'mean' : /numarul\s+de\s+(localitati|tari|orase|comune|firme)\b/.test(t) && !ctx.vars.some((v) => /firm/i.test(v)) ? 'size' : 'sum';
      if (hVars.length) p.vars = hVars;
      if (p.levels.length === 1) p.indexName = idxFix(p.levels[0]);
      if (p.agg === 'size') p.name = H[1] || 'Numar';
      const so = t.match(/(?:ordinea\s+(?:des)?crescatoare|sortat\w*\s+(?:des)?crescator)\s+(?:a|al|dupa)?\s*(.{0,50})/);
      if (so && p.sort !== 'none') p.sortBy = matchCol(so[1], p.vars) || '';
      break;
    }
    case 'rata_grup': {
      const r = parseRatio(t, ctx);
      Object.assign(p, { group: g || ctx.groupCols[0] || '', A: r.A, B: r.B || popCol(ctx), k: r.k });
      p.name = H[1] || (/rata/.test(t) ? 'Rata' : 'Pondere');
      p.indexName = idxFix(p.group);
      break;
    }
    case 'argmax_coloane': {
      const ex = t.match(RX.ext);
      const ent = ex ? entityBefore(t, ex.index) : null;
      p.level = g || '__rand__';
      p.fn = RX.minw.test(t) ? 'min' : 'max';
      if (hVars.length > 1) p.vars = hVars;
      p.name = lastIsNew ? H[H.length - 1] : (H[1] && !ctx.vars.includes(H[1]) ? H[1] : ent ? ENT_NAME(ent.word) : 'Variabila');
      p.keepName = !!(ctx.nameCol && (H.length ? H.includes(ctx.nameCol) : p.level === '__rand__'));
      if (p.level !== '__rand__') p.indexName = idxFix(p.level);
      break;
    }
    case 'max_in_grup': {
      const ex = t.match(RX.ext);
      const ent = ex ? entityBefore(t, ex.index) : null;
      p.group = g || ctx.groupCols[0] || '';
      p.fn = RX.minw.test(t) ? 'min' : 'max';
      p.show = ctx.nameCol || '';
      p.perVar = /(pentru|la)\s+fiecare\s+(indicator|variabil|activitat|etni|categori)|fiecarui\s+indicator|fiecarei\s+(variabile|activitati)/.test(t);
      if (ex) {
        const after = t.slice(ex.index + ex[0].length).split(/\s+(?:si|pentru|la\s+nivel|din\s+fiecare)\s|[,.;(]/)[0];
        const r = parseRatio(after, ctx);
        // fără o coloană potrivită („cifra de afaceri” când există doar activități) = totalul variabilelor
        if (r.found) Object.assign(p, { A: r.A, B: r.B, k: r.k });
        else Object.assign(p, { A: matchCol(after, numCands(ctx)) || (ctx.vars.length > 1 ? '__total__' : ctx.vars[0] || ''), B: '' });
      }
      if (ent && ent.kind === 'row' && /^judet/.test(ent.word) && p.group && !/judet|county/i.test(p.group)) {
        const jc = ctx.groupCols.find((c) => /^judet|^county|^indicativ/i.test(c));
        if (jc) { p.agr = jc; p.show = jc; }
      }
      if (H.length === 3) { p.withValue = true; p.cols2 = H.slice(1); }
      p.name = H.length === 2 ? H[1] : ent ? ENT_NAME(ent.word) : 'Localitate';
      if (hVars.length > 1) { p.perVar = true; p.vars = hVars; }
      p.indexName = idxFix(p.group);
      break;
    }
    case 'medie_ponderata': {
      p.group = g || ctx.groupCols[0] || '';
      const wm = t.match(/(?:ca\s+)?pondere\w*\s+(\w+(?:\s+\w+)?)/);
      p.w = (wm && matchCol(wm[1], numCands(ctx))) || popCol(ctx);
      if (hVars.length) p.vars = hVars;
      p.indexName = idxFix(p.group);
      break;
    }
    case 'localizare': {
      p.group = g || ctx.groupCols[0] || '';
      p.P = popCol(ctx);
      if (hVars.length) p.vars = hVars;
      p.indexName = idxFix(p.group);
      break;
    }
    case 'disimilaritate':
    case 'shannon':
    case 'coef_variatie': {
      p.group = g || ctx.groupCols[0] || '';
      if (hVars.length) p.vars = hVars;
      p.indexName = idxFix(p.group);
      break;
    }
    case 'top_n': {
      const m = t.match(RX.top);
      p.N = m ? m[2] : '1';
      p.dir = RX.minw.test(t) ? 'asc' : 'desc';
      const ex = t.match(RX.ext);
      const phrase = ex ? t.slice(ex.index + ex[0].length).split(/[,.;(]|\s+si\s/)[0] : t;
      p.col = matchCol(phrase, numCands(ctx)) || ctx.vars[0] || '';
      p.group = g;
      p.keep = ctx.nameCol ? [ctx.nameCol] : [];
      break;
    }
    case 'valori_lipsa':
      p.out = req.outFile || '';
      break;
    case 'pivot': {
      const cols = ctx.main.header;
      const nonNum = cols.filter((c, j) => !ctx.main.types[j].numeric);
      let m = t.match(/(\w+)\s+pe\s+linii/);
      let index = m ? matchCol(m[1], cols) : null;
      m = t.match(/(\w+)\s+pe\s+coloane/);
      let columns = m ? matchCol(m[1], cols) : null;
      index = index || nonNum[0] || cols[0];
      columns = columns || nonNum.find((c) => c !== index && /^an|year/i.test(c)) || nonNum.find((c) => c !== index) || cols[1];
      const values = cols.filter((c, j) => ctx.main.types[j].numeric).slice(-1)[0] || cols[cols.length - 1];
      Object.assign(p, { index, columns, values, nan: /lipsa|nan\b|nule/.test(t), out: req.outFile || '' });
      break;
    }
    case 'cov_corr_std': {
      const what = [];
      if (RX.cov.test(t)) what.push('cov');
      if (RX.corr.test(t)) what.push('corr');
      if (RX.std.test(t)) what.push('std');
      p.what = what.length ? what : ['corr'];
      const piv = [...prev].reverse().find((r) => r.type === 'pivot');
      p.src = piv ? piv.id : 'main';
      p.outs = {};
      const dflt = { cov: 'V.csv', corr: 'R.csv', std: 'x_std.csv' };
      for (const w of p.what) p.outs[w] = p.what.length === 1 && req.outFile ? req.outFile : dflt[w];
      break;
    }
    case 'acp': {
      p.parts = acpParts(t);
      p.std = !/nestandardiz|fara\s+standardiz|date(le)?\s+brute/.test(t);
      p.outs = {};
      const dflt = { varianta: 'Varianta.csv', corelatii: 'r.csv', scoruri: 's.csv', cosinusuri: 'cosin.csv', contributii: 'contrib.csv', comunalitati: 'comm.csv' };
      for (const w of p.parts) p.outs[w] = p.parts.length === 1 && req.outFile ? req.outFile : dflt[w];
      break;
    }
    case 'custom':
      p.code = `# Scrie aici codul pentru cerința ${req.num}\n# (nu am recunoscut tipul automat — alege un tip din listă)\n`;
      break;
    default:
  }
  return p;
}

export function detectAll(problem, ctx) {
  const out = [];
  if (!ctx.main || !ctx.main.header.length) return out;
  for (const req of problem.reqs) {
    const types = classify(req, ctx);
    types.forEach((type, i) => {
      const id = types.length > 1 ? `${req.num}${'abcdefgh'[i]}` : String(req.num);
      const params = deriveParams(type, req, ctx, out);
      if (types.length > 1 && !req.outFile) params.out = `Cerinta${req.num}_${type}.csv`;
      else if (types.length > 1) params.out = req.outFile.replace(/\.csv$/i, `_${type}.csv`);
      out.push({ id, num: req.num, desc: req.desc, example: req.example, points: i === 0 ? req.points : '', outFile: req.outFile, type, params });
    });
  }
  return out;
}

// ───────────────────────── unirea fișierelor (merge) ─────────────────────────
const KEYNAME = [
  /^(siruta|cod_?siruta|code|cod|codsiruta|siruta_?cod)$/i,
  /^(judet|judete|county|indicativ_?judet|cod_?judet|jud)$/i,
  /^(regiune|region|regiuni)$/i,
  /^(code|cod|iso|iso3|cod_?tara|country_?code|tara|country)$/i,
];
function nameCompat(a, b) {
  if (norm(a) === norm(b)) return true;
  return KEYNAME.some((re) => re.test(a) && re.test(b));
}
function overlap(A, B, ci = false) {
  if (!A || !B || !A.size || !B.size) return 0;
  const bb = ci ? new Set([...B].map((x) => x.toLowerCase())) : B;
  let n = 0;
  for (const v of A) if (bb.has(ci ? v.toLowerCase() : v)) n++;
  return n / Math.min(A.size, B.size);
}
const mostlyUpper = (S) => { let u = 0, n = 0; for (const v of S) { if (/[a-z]/i.test(v)) { n++; if (v === v.toUpperCase()) u++; } } return n && u / n > 0.5; };
const keyLike = (f, col, j) => j === 0 || !(f.types[j] && f.types[j].numeric) || /cod|code|siruta|judet|county|regiun|indicativ|iso|id$/i.test(col);

function findJoin(frame, f) {
  const lefts = [];
  if (frame.idx) lefts.push({ leftOn: null, name: frame.idx, vals: frame.idxVals });
  for (const c of frame.cols) if (c.key) lefts.push({ leftOn: c.name, name: c.name, vals: c.vals() });
  let best = null;
  f.header.forEach((h, j) => {
    if (!keyLike(f, h, j)) return;
    const rv = colValues(f, h);
    for (const L of lefts) {
      let score = 0, caseFix = null;
      if (L.vals && rv) {
        const o = overlap(L.vals, rv);
        if (o >= 0.3) score = 1 + o;
        else {
          const oc = overlap(L.vals, rv, true);
          if (oc >= 0.3) { score = 0.9 + oc; caseFix = mostlyUpper(L.vals) ? 'upper' : 'lower'; }
        }
      } else if (nameCompat(L.name, h)) score = 0.8;
      if (!score) continue;
      score += (j === 0 ? 0.2 : 0) + (L.leftOn === null ? 0.1 : 0) + (norm(L.name) === norm(h) ? 0.1 : 0);
      if (!best || score > best.score) best = { score, leftOn: L.leftOn, fKey: j, caseFix };
    }
  });
  return best;
}

function planMerges(ctx, needed) {
  const main = ctx.main;
  const frame = {
    idx: ctx.idx,
    idxVals: ctx.idx ? colValues(main, ctx.idx) : null,
    cols: ctx.cols.map((c) => ({ name: c, key: keyLike(main, c, main.header.indexOf(c)), vals: () => colValues(main, c) })),
  };
  const has = (c) => frame.cols.some((x) => x.name === c);
  const used = new Set([main.name]);
  const steps = [];
  const apply = (f, j) => {
    f.indexCol = j.fKey;
    const fcols = f.header.filter((h, k) => k !== j.fKey);
    const bring = fcols.filter((c) => !has(c));
    steps.push({ file: f, leftOn: j.leftOn, fKey: j.fKey, select: bring.length < fcols.length ? bring : null, caseFix: j.caseFix });
    for (const c of bring) {
      const k = f.header.indexOf(c);
      frame.cols.push({ name: c, key: keyLike(f, c, k), vals: () => colValues(f, c) });
    }
    used.add(f.name);
  };
  let missing = needed.filter((c) => !has(c));
  for (let guard = 0; missing.length && guard < 8; guard++) {
    let progress = false;
    for (const f of ctx.files) {
      if (used.has(f.name) || !f.header.length || !missing.some((c) => f.header.includes(c))) continue;
      const j = findJoin(frame, f);
      if (j) { apply(f, j); progress = true; break; }
    }
    if (!progress) {
      outer: for (const gf of ctx.files) {
        if (used.has(gf.name) || !gf.header.length) continue;
        const jg = findJoin(frame, gf);
        if (!jg) continue;
        const sim = { ...frame, cols: [...frame.cols, ...gf.header.filter((h, k) => k !== jg.fKey).map((c) => ({ name: c, key: keyLike(gf, c, gf.header.indexOf(c)), vals: () => colValues(gf, c) }))] };
        for (const f of ctx.files) {
          if (f === gf || used.has(f.name) || !missing.some((c) => f.header.includes(c))) continue;
          if (findJoin(sim, f)) { apply(gf, jg); progress = true; break outer; }
        }
      }
    }
    if (!progress) break;
    missing = needed.filter((c) => !has(c));
  }
  return { steps, missing };
}

// ───────────────────────── funcții ajutătoare (Python) ─────────────────────────
const HELPERS = {
  calcul_medie: `def calcul_medie(df: pd.DataFrame):
    # ultima coloana = ponderea, restul = valorile
    x = df.values
    medii = np.average(x[:, :-1], axis=0, weights=x[:, -1])
    return pd.Series(medii, df.columns[:-1])`,
  nan_replace_df: `def nan_replace_df(df: pd.DataFrame):
    for c in df.columns:
        if df[c].isna().any():
            if is_numeric_dtype(df[c]):
                df.fillna({c: df[c].mean()}, inplace=True)
            else:
                df.fillna({c: df[c].mode()[0]}, inplace=True)`,
  nan_replace: `def nan_replace(x: np.ndarray):
    # fiecare NaN devine media coloanei lui
    y = x.copy()
    k = np.where(np.isnan(y))
    y[k] = np.nanmean(y[:, k[1]], axis=0)
    return y`,
  standardize: `def standardize(x: np.ndarray, scal=True, ddof=0):
    x_ = x - np.mean(x, axis=0)
    if scal:
        x_ = x_ / np.std(x_, axis=0, ddof=ddof)
    return x_`,
  disimilaritate: `def disimilaritate(df: pd.DataFrame):
    # D = 1/2 * suma |x_i/Tx - r_i/Tr|
    x = df.values
    tx = np.sum(x, axis=0)
    tx[tx == 0] = 1
    sx = np.sum(x, axis=1)
    r = (sx - x.T).T
    tr = np.sum(r, axis=0)
    tr[tr == 0] = 1
    d = 0.5 * np.sum(np.abs(x / tx - r / tr), axis=0)
    return pd.Series(d, df.columns)`,
  shannon: `def shannon(df: pd.DataFrame):
    # H = -suma p_i * log2(p_i), p_i = ponderea randului i in totalul coloanei
    x = df.values
    tx = np.sum(x, axis=0)
    tx[tx == 0] = 1
    p = x / tx
    p[p == 0] = 1
    h = -np.sum(p * np.log2(p), axis=0)
    return pd.Series(h, df.columns)`,
  acp: `def acp(x: np.ndarray, std=True, nlib=0):
    x_ = x - np.mean(x, axis=0)
    if std:
        x_ = x_ / np.std(x_, axis=0)
    n, m = x.shape
    r_v = (1 / (n - nlib)) * x_.T @ x_
    valp, vecp = np.linalg.eig(r_v)
    valp = np.real(valp)
    vecp = np.real(vecp)
    k = np.flip(np.argsort(valp))
    alpha = valp[k]
    a = vecp[:, k]
    c = x_ @ a
    if std:
        r = a * np.sqrt(alpha)
    else:
        r = np.corrcoef(x_, c, rowvar=False)[:m, m:]
    return x_, r_v, alpha, a, c, r`,
  tabelare_varianta: `def tabelare_varianta(alpha: np.ndarray):
    m = len(alpha)
    varianta_totala = sum(alpha)
    procent = alpha * 100 / varianta_totala
    df_varianta = pd.DataFrame(
        {
            "Varianta": alpha,
            "Varianta cumulata": np.cumsum(alpha),
            "Procent varianta": procent,
            "Procent cumulat": np.cumsum(procent)
        }, index=["C" + str(i + 1) for i in range(m)]
    )
    return df_varianta`,
  tabelare_salvare_matrice: `def tabelare_salvare_matrice(x: np.ndarray, index_linie, index_coloana, nume_index, nume_fisier=None):
    df = pd.DataFrame(x, index=index_linie, columns=index_coloana)
    df.index.name = nume_index
    if nume_fisier is not None:
        df.to_csv("__OUT__" + nume_fisier)
    return df`,
  plot_varianta: `def plot_varianta(alpha: np.ndarray, std=True, P=80):
    fig = plt.figure(figsize=(10, 6))
    ax = fig.add_subplot(1, 1, 1)
    m = len(alpha)
    x = np.arange(1, m + 1)
    ax.plot(x, alpha)
    ax.set_xticks(x)
    ax.set_title("Plot varianta", fontdict={"fontsize": 16})
    ax.set_xlabel("Componenta", fontdict={"fontsize": 12, "color": "b"})
    ax.set_ylabel("Varianta", fontdict={"fontsize": 12, "color": "b"})
    ax.scatter(x, alpha, c="r", alpha=0.5)
    if std:
        k1 = len(np.where(alpha > 1)[0])
        ax.axhline(1, color="m", label="Kaiser")
    else:
        k1 = None
    procent_cumulat = np.cumsum(alpha * 100 / sum(alpha))
    k2 = np.where(procent_cumulat > P)[0][0] + 1
    ax.axhline(alpha[k2 - 1], color="g", label="Varianta cumulata (>" + str(P) + "%)")
    eps = alpha[:m - 1] - alpha[1:]
    d = eps[:m - 2] - eps[1:]
    if np.any(d < 0):
        k3 = np.where(d < 0)[0][0] + 2
        ax.axhline(alpha[k3 - 1], color="c", label="Criteriul Cattell (Elbow)")
    else:
        k3 = None
    ax.legend()
    return k1, k2, k3`,
  corelograma: `def corelograma(df: pd.DataFrame, titlu="Corelatii factoriale", vmin=-1, annot=True, cmap="RdYlBu"):
    fig = plt.figure(figsize=(10, 6))
    ax = fig.add_subplot(1, 1, 1)
    ax.set_title(titlu, fontdict={"fontsize": 16})
    heatmap(df, vmin=vmin, vmax=1, cmap=cmap, annot=annot, ax=ax)`,
  plot_scoruri_corelatii: `def plot_scoruri_corelatii(df: pd.DataFrame, col_x="C1", col_y="C2", titlu="Plot scoruri", scoruri=True, etichetare=True):
    fig = plt.figure(figsize=(7, 7))
    ax = fig.add_subplot(1, 1, 1, aspect=1)
    ax.set_title(titlu, fontdict={"fontsize": 16})
    ax.set_xlabel(col_x, fontdict={"fontsize": 12, "color": "b"})
    ax.set_ylabel(col_y, fontdict={"fontsize": 12, "color": "b"})
    ax.scatter(df[col_x], df[col_y], c="r", alpha=0.5)
    if not scoruri:
        x = np.arange(0, np.pi * 2 + 0.05, 0.05)
        ax.plot(np.cos(x), np.sin(x))
        ax.plot(0.7 * np.cos(x), 0.7 * np.sin(x), color="g")
        ax.axvline(0, color="k", linestyle="--")
        ax.axhline(0, color="k", linestyle="--")
    if etichetare:
        for i in range(len(df)):
            ax.text(df[col_x].values[i], df[col_y].values[i], df.index[i])`,
  show: `def show():
    plt.show()`,
};
const HELPER_ORDER = Object.keys(HELPERS);
const PLOT_HELPERS = new Set(['plot_varianta', 'corelograma', 'plot_scoruri_corelatii', 'show']);

// ───────────────────────── șabloane de cerințe ─────────────────────────
const shortG = (g) => (g === '__rand__' ? 'loc' : /^judet|^county|^indicativ/i.test(g) ? 'jud' : /macro/i.test(g) ? 'macroreg' : /^regiun|^region/i.test(g) ? 'reg' : /continent/i.test(g) ? 'cont' : norm(g).replace(/[^a-z0-9]+/g, '_').slice(0, 10));
const suffixFile = (out, suf) => (out || 'Cerinta.csv').replace(/(\.csv)?$/i, `_${suf}.csv`);
function V(list, ctx) {
  const l = list || [];
  return l.length === ctx.vars.length && l.every((v, i) => v === ctx.vars[i]) ? ctx.varsName : pyList(l);
}
function LP(list, extra, ctx) {
  const v = V(list, ctx);
  const ex = (extra || []).filter(Boolean);
  if (!ex.length) return v;
  return v.startsWith('[') ? pyList([...(list || []), ...ex]) : `${v} + ${pyList(ex)}`;
}
function saveLine(v, p, ctx, { series = false, sortBy = null, allowSort = true } = {}) {
  let e = v;
  if (allowSort && p.sort && p.sort !== 'none' && (series || sortBy)) {
    const asc = p.sort === 'asc' ? 'True' : 'False';
    e += series ? `.sort_values(ascending=${asc})` : `.sort_values(by=${pyStr(sortBy)}, ascending=${asc})`;
  }
  if (p.round !== '' && p.round != null) e += `.round(${p.round})`;
  return `${e}.to_csv(${pyStr(ctx.dirOut + (p.out || 'Cerinta.csv'))}${p.noIndex ? ', index=False' : ''})`;
}
const idxName = (L, v, p) => { if (p.indexName) L.push(`${v}.index.name = ${pyStr(p.indexName)}`); };
function gapply(L, lhs, srcExpr, colsExpr, valueCols, g, func, ctx) {
  // groupby + apply, cu sau fără include_groups (pandas >= 2.2)
  if (ctx.ig) {
    L.push(`${lhs} = ${srcExpr}[${colsExpr}].groupby(by=${pyStr(g)}).apply(`);
    L.push(`    func=${func},`);
    L.push(`    include_groups=False)`);
  } else {
    L.push(`${lhs} = ${srcExpr}[${colsExpr}].groupby(by=${pyStr(g)})[${valueCols}].apply(`);
    L.push(`    func=${func})`);
  }
}
const fieldsOut = (round = true) => [
  { k: 'out', label: 'Fișierul rezultat', type: 'text' },
  ...(round ? [{ k: 'round', label: 'Rotunjire', type: 'select', options: [['', 'fără'], ['0', '0 zecimale'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']] }] : []),
];
const F_SORT = { k: 'sort', label: 'Sortare', type: 'select', options: [['none', 'fără'], ['desc', 'descrescător'], ['asc', 'crescător']] };
const F_IDX = { k: 'indexName', label: 'Nume coloană index (opțional)', type: 'text', placeholder: 'ex. Judet' };

export const TEMPLATES = {
  filtru: {
    title: 'Filtrare rânduri',
    help: 'Rândurile care respectă o condiție, ex. „localitățile în care numărul de angajați este mai mare decât 0”.',
    fields: [
      { k: 'col', label: 'Condiția pe coloana', type: 'col', allowTotal: true, from: 'main' },
      { k: 'op', label: 'Operator', type: 'select', options: ['>', '>=', '<', '<=', '==', '!='] },
      { k: 'val', label: 'Valoare (număr sau „media”)', type: 'text' },
      { k: 'totalName', label: 'Salvează și totalul în coloana (opțional)', type: 'text', placeholder: 'ex. CifraAfaceri', showIf: (p) => p.col === '__total__' },
      { k: 'keep', label: 'Coloane salvate (nimic bifat = toate)', type: 'cols', from: 'main' },
      F_SORT, { k: 'sortBy', label: 'Sortează după', type: 'col', optional: true, from: 'main' }, ...fieldsOut(),
    ],
    defaults: (ctx) => ({ col: ctx.vars.length > 1 ? '__total__' : ctx.vars[0] || '', op: '>', val: '0', keep: [], sortBy: '', totalName: '' }),
    needs: (p, ctx) => [...(p.col === '__total__' ? ctx.vars : [p.col]), ...(p.keep || []), p.sortBy],
    gen(p, ctx, n, F) {
      const L = [];
      const S = F(p.col === '__total__' ? ctx.vars : [p.col, ...(p.keep || [])]);
      const v0 = String(p.val ?? '').trim();
      const val = (base) => (/^medi/i.test(v0) ? `${base}.mean()` : isNumStr(v0) ? v0 : pyStr(v0));
      let cond;
      if (p.col === '__total__') {
        L.push(`s_total${n} = ${S}[${V(ctx.vars, ctx)}].apply(`, `    func=lambda x: x.sum(),`, `    axis=1)`);
        cond = `s_total${n} ${p.op} ${val(`s_total${n}`)}`;
      } else cond = `${S}[${pyStr(p.col)}] ${p.op} ${val(`${S}[${pyStr(p.col)}]`)}`;
      const sel = p.keep && p.keep.length ? `[${pyList(p.keep)}]` : '';
      const v = `df_cerinta${n}`;
      const withTotal = p.col === '__total__' && String(p.totalName || '').trim();
      if (withTotal) {
        L.push(`${v} = ${S}[${cond}]${sel}.copy()`);
        L.push(`${v}[${pyStr(withTotal)}] = s_total${n}`);
      } else L.push(`${v} = ${S}[${cond}]${sel}`);
      idxName(L, v, p);
      L.push(saveLine(v, p, ctx, { sortBy: p.sortBy || (withTotal || (p.col !== '__total__' ? p.col : null)) }));
      return { lines: L };
    },
  },

  indicator_rand: {
    title: 'Indicator pe fiecare rând (raport, diferență…)',
    help: 'Ex. „raportul dintre cifra de afaceri și numărul de salariați pentru fiecare localitate”.',
    fields: [
      { k: 'A', label: 'Coloana A', type: 'col', allowTotal: true },
      { k: 'op', label: 'Formula', type: 'select', options: [['div', 'A / B'], ['divk', 'A × k / B'], ['sub', 'A − B'], ['add', 'A + B'], ['mul', 'A × B'], ['pct', '(A − B) × 100 / B'], ['share', 'A × 100 / (A + B)']] },
      { k: 'B', label: 'Coloana B', type: 'col' },
      { k: 'k', label: 'k', type: 'text', showIf: (p) => p.op === 'divk' },
      { k: 'filt', label: 'Doar rândurile unde B > 0', type: 'bool' },
      { k: 'keep', label: 'Coloane salvate înaintea indicatorului', type: 'cols', from: 'all' },
      { k: 'name', label: 'Numele coloanei noi', type: 'text' },
      F_SORT, ...fieldsOut(), { k: 'noIndex', label: 'Fără coloana index (index=False)', type: 'bool' },
    ],
    defaults: (ctx) => ({ A: ctx.vars[0] || '', op: 'div', B: ctx.vars[1] || '', k: '1000', filt: false, keep: ctx.nameCol ? [ctx.nameCol] : [], name: 'Indicator', noIndex: false }),
    needs: (p, ctx) => [...(p.A === '__total__' ? ctx.vars : [p.A]), p.B, ...(p.keep || [])],
    gen(p, ctx, n, F) {
      const L = [];
      const S = F([...(p.A === '__total__' ? ctx.vars : [p.A]), p.B, ...(p.keep || [])]);
      let base = S;
      if (p.filt) { L.push(`df_c${n} = ${S}[${S}[${pyStr(p.B)}] > 0]`); base = `df_c${n}`; }
      const a = p.A === '__total__' ? `${base}[${V(ctx.vars, ctx)}].sum(axis=1)` : `${base}[${pyStr(p.A)}]`;
      const b = `${base}[${pyStr(p.B)}]`;
      const expr = { divk: `${a} * ${p.k || 1000} / ${b}`, sub: `${a} - ${b}`, add: `${a} + ${b}`, mul: `${a} * ${b}`, pct: `(${a} - ${b}) * 100 / ${b}`, share: `${a} * 100 / (${a} + ${b})` }[p.op] || `${a} / ${b}`;
      if (p.keep && p.keep.length) {
        const v = `df_cerinta${n}`;
        L.push(`${v} = ${base}[${pyList(p.keep)}].copy()`);
        L.push(`${v}[${pyStr(p.name)}] = ${expr}`);
        idxName(L, v, p);
        L.push(saveLine(v, p, ctx, { sortBy: p.name }));
      } else {
        const v = `s_cerinta${n}`;
        L.push(`${v} = ${expr}`, `${v}.name = ${pyStr(p.name)}`);
        idxName(L, v, p);
        L.push(saveLine(v, p, ctx, { series: true }));
      }
      return { lines: L };
    },
  },

  indicator_variabile: {
    title: 'Indicator pentru fiecare variabilă (pe rând)',
    help: 'Fiecare variabilă împărțită la o coloană, ex. „angajați la 1000 de locuitori pentru fiecare activitate”.',
    fields: [
      { k: 'vars', label: 'Variabile', type: 'cols', from: 'vars' },
      { k: 'B', label: 'Împarte la', type: 'col' },
      { k: 'k', label: 'Înmulțește cu k', type: 'text' },
      { k: 'keepName', label: 'Pune și coloana cu numele (insert)', type: 'bool' },
      ...fieldsOut(),
    ],
    defaults: (ctx) => ({ vars: ctx.vars.slice(), B: popCol(ctx), k: '1', keepName: !!ctx.nameCol }),
    needs: (p, ctx) => [...p.vars, p.B, ...(p.keepName && ctx.nameCol ? [ctx.nameCol] : [])],
    gen(p, ctx, n, F) {
      const L = [];
      const S = F([...p.vars, p.B]);
      const v = `df_cerinta${n}`;
      const kk = p.k && String(p.k).trim() !== '1' ? ` * ${p.k}` : '';
      L.push(`${v} = ${S}[${LP(p.vars, [p.B], ctx)}].apply(`);
      L.push(`    func=lambda x: x[${V(p.vars, ctx)}]${kk} / x[${pyStr(p.B)}],`);
      L.push(`    axis=1)`);
      if (p.keepName && ctx.nameCol) L.push(`${v}.insert(0, ${pyStr(ctx.nameCol)}, ${S}[${pyStr(ctx.nameCol)}])`);
      L.push(saveLine(v, p, ctx, { allowSort: false }));
      return { lines: L };
    },
  },

  procente: {
    title: 'Procente (structură)',
    help: 'Ex. „procentul de angajați pe fiecare activitate la nivel de localitate”, „procentele pe etnii la nivelul județelor”.',
    fields: [
      { k: 'levels', label: 'La nivel de', type: 'groups', includeRow: true },
      { k: 'vars', label: 'Variabile', type: 'cols', from: 'vars' },
      { k: 'axis', label: 'Procent din', type: 'select', options: [['1', 'totalul rândului (structura)'], ['0', 'totalul coloanei (pondere în total)']] },
      { k: 'zero', label: 'Dacă totalul e 0, procentele sunt 0', type: 'bool' },
      { k: 'keepName', label: 'Pune și coloana cu numele (nivel rând)', type: 'bool' },
      ...fieldsOut(),
    ],
    defaults: (ctx) => ({ levels: ['__rand__'], vars: ctx.vars.slice(), axis: '1', zero: false, keepName: !!ctx.nameCol }),
    needs: (p, ctx) => [...p.vars, ...(p.levels || []), ...(p.keepName && ctx.nameCol ? [ctx.nameCol] : [])],
    gen(p, ctx, n, F) {
      const L = [];
      const levels = p.levels && p.levels.length ? p.levels : ['__rand__'];
      const multi = levels.length > 1;
      for (const g of levels) {
        const suf = multi ? '_' + shortG(g) : '';
        const v = `df_cerinta${n}${suf}`;
        let src;
        if (g === '__rand__') src = F([...p.vars, ...(p.keepName && ctx.nameCol ? [ctx.nameCol] : [])]);
        else {
          src = `df_${shortG(g)}${n}`;
          L.push(`${src} = ${F([...p.vars, g])}[${LP(p.vars, [g], ctx)}].groupby(by=${pyStr(g)}).sum()`);
        }
        L.push(`${v} = ${src}[${V(p.vars, ctx)}].apply(`);
        L.push(`    func=lambda x: x * 100 / x.sum(),`);
        L.push(`    axis=${p.axis || 1})`);
        if (p.zero) L.push(`${v} = ${v}.fillna(0)  # unde totalul e 0 -> procente 0`);
        if (g === '__rand__' && p.keepName && ctx.nameCol) L.push(`${v}.insert(0, ${pyStr(ctx.nameCol)}, ${src}[${pyStr(ctx.nameCol)}])`);
        L.push(saveLine(v, { ...p, out: multi ? suffixFile(p.out, shortG(g)) : p.out }, ctx, { allowSort: false }));
      }
      return { lines: L };
    },
  },

  agregare: {
    title: 'Totaluri / medii pe grupuri',
    help: 'Ex. „populația pe etnii la nivelul județelor, regiunilor și macroregiunilor”.',
    fields: [
      { k: 'levels', label: 'Grupare după', type: 'groups' },
      { k: 'vars', label: 'Variabile', type: 'cols', from: 'numeric' },
      { k: 'agg', label: 'Funcția', type: 'select', options: [['sum', 'sumă'], ['mean', 'medie'], ['max', 'maxim'], ['min', 'minim'], ['median', 'mediană'], ['std', 'abatere standard'], ['count', 'număr de valori'], ['size', 'număr de rânduri']] },
      { k: 'name', label: 'Numele coloanei', type: 'text', showIf: (p) => p.agg === 'size' },
      F_SORT, { k: 'sortBy', label: 'Sortează după', type: 'col', optional: true }, ...fieldsOut(), F_IDX,
    ],
    defaults: (ctx) => ({ levels: ctx.groupCols.length ? [ctx.groupCols[0]] : [], vars: ctx.vars.slice(), agg: 'sum', name: 'Numar', sortBy: '' }),
    needs: (p) => [...(p.agg === 'size' ? [] : p.vars), ...(p.levels || []), p.sortBy],
    gen(p, ctx, n, F) {
      const L = [];
      const levels = p.levels && p.levels.length ? p.levels : [];
      if (!levels.length) return { lines: ['# Alege coloana de grupare (ex. Judet)'] };
      const multi = levels.length > 1;
      for (const g of levels) {
        const suf = multi ? '_' + shortG(g) : '';
        const out = multi ? suffixFile(p.out, shortG(g)) : p.out;
        if (p.agg === 'size') {
          const v = `s_cerinta${n}${suf}`;
          L.push(`${v} = ${F([g])}.groupby(by=${pyStr(g)}).size()`, `${v}.name = ${pyStr(p.name || 'Numar')}`);
          if (!multi) idxName(L, v, p);
          L.push(saveLine(v, { ...p, out }, ctx, { series: true }));
        } else {
          const v = `df_cerinta${n}${suf}`;
          L.push(`${v} = ${F([...p.vars, g])}[${LP(p.vars, [g], ctx)}].groupby(by=${pyStr(g)}).${p.agg || 'sum'}()`);
          if (!multi) idxName(L, v, p);
          L.push(saveLine(v, { ...p, out }, ctx, { sortBy: p.sortBy }));
        }
      }
      return { lines: L };
    },
  },

  rata_grup: {
    title: 'Rată / pondere pe grupuri',
    help: 'Raport între totaluri pe grup, ex. „salariați la 1000 locuitori pentru fiecare județ”, „ponderea angajaților în populație”.',
    fields: [
      { k: 'group', label: 'Pentru fiecare', type: 'group' },
      { k: 'A', label: 'Numărător (A)', type: 'col', allowTotal: true },
      { k: 'B', label: 'Numitor (B)', type: 'col' },
      { k: 'k', label: 'Înmulțește cu k', type: 'text' },
      { k: 'name', label: 'Numele coloanei', type: 'text' },
      F_SORT, ...fieldsOut(), F_IDX,
    ],
    defaults: (ctx) => ({ group: ctx.groupCols[0] || '', A: ctx.vars[0] || '', B: popCol(ctx), k: '1', name: 'Rata' }),
    needs: (p, ctx) => [...(p.A === '__total__' ? ctx.vars : [p.A]), p.B, p.group],
    gen(p, ctx, n, F) {
      const L = [];
      const g = p.group;
      const aCols = p.A === '__total__' ? ctx.vars : [p.A];
      const gv = `df_${shortG(g)}${n}`;
      L.push(`${gv} = ${F([...aCols, p.B, g])}[${LP(aCols, [p.B, g], ctx)}].groupby(by=${pyStr(g)}).sum()`);
      const a = p.A === '__total__' ? `${gv}[${V(ctx.vars, ctx)}].sum(axis=1)` : `${gv}[${pyStr(p.A)}]`;
      const kk = p.k && String(p.k).trim() !== '1' ? ` * ${p.k}` : '';
      const v = `s_cerinta${n}`;
      L.push(`${v} = ${a}${kk} / ${gv}[${pyStr(p.B)}]`, `${v}.name = ${pyStr(p.name)}`);
      idxName(L, v, p);
      L.push(saveLine(v, p, ctx, { series: true }));
      return { lines: L };
    },
  },

  argmax_coloane: {
    title: 'Coloana cu valoarea maximă (activitatea dominantă)',
    help: 'Numele variabilei cu cea mai mare valoare, ex. „activitatea cu cei mai mulți angajați la nivel de județ”, „anul cu valoarea maximă”.',
    fields: [
      { k: 'level', label: 'La nivel de', type: 'group', includeRow: true },
      { k: 'vars', label: 'Variabile', type: 'cols', from: 'vars' },
      { k: 'fn', label: 'Caută', type: 'select', options: [['max', 'maximul'], ['min', 'minimul']] },
      { k: 'keepName', label: 'Pune și coloana cu numele (nivel rând)', type: 'bool' },
      { k: 'name', label: 'Numele coloanei rezultat', type: 'text' },
      ...fieldsOut(false), F_IDX,
    ],
    defaults: (ctx) => ({ level: ctx.groupCols[0] || '__rand__', vars: ctx.vars.slice(), fn: 'max', keepName: false, name: 'Activitate' }),
    needs: (p, ctx) => [...p.vars, p.level, ...(p.keepName && ctx.nameCol ? [ctx.nameCol] : [])],
    gen(p, ctx, n, F) {
      const L = [];
      const f = p.fn === 'min' ? 'argmin' : 'argmax';
      const lam = [`    func=lambda x: x.index[x.${f}()],`, `    axis=1)`];
      if (p.level && p.level !== '__rand__') {
        const g = p.level;
        const gv = `df_${shortG(g)}${n}`;
        L.push(`${gv} = ${F([...p.vars, g])}[${LP(p.vars, [g], ctx)}].groupby(by=${pyStr(g)}).sum()`);
        const v = `s_cerinta${n}`;
        L.push(`${v} = ${gv}[${V(p.vars, ctx)}].apply(`, ...lam);
        L.push(`${v}.name = ${pyStr(p.name)}`);
        idxName(L, v, p);
        L.push(saveLine(v, p, ctx, { allowSort: false }));
      } else {
        const S = F([...p.vars, ...(p.keepName && ctx.nameCol ? [ctx.nameCol] : [])]);
        if (p.keepName && ctx.nameCol) {
          const v = `df_cerinta${n}`;
          L.push(`${v} = ${S}[[${pyStr(ctx.nameCol)}]].copy()`);
          L.push(`${v}[${pyStr(p.name)}] = ${S}[${V(p.vars, ctx)}].apply(`, ...lam);
          L.push(saveLine(v, p, ctx, { allowSort: false }));
        } else {
          const v = `s_cerinta${n}`;
          L.push(`${v} = ${S}[${V(p.vars, ctx)}].apply(`, ...lam);
          L.push(`${v}.name = ${pyStr(p.name)}`);
          L.push(saveLine(v, p, ctx, { allowSort: false }));
        }
      }
      return { lines: L };
    },
  },

  max_in_grup: {
    title: 'Pentru fiecare grup: rândul cu maximul',
    help: 'Ex. „pentru fiecare județ, localitatea cu cel mai mare profit pe locuitor”.',
    fields: [
      { k: 'group', label: 'Pentru fiecare', type: 'group' },
      { k: 'perVar', label: 'Câte un rezultat pentru fiecare variabilă', type: 'bool' },
      { k: 'A', label: 'Indicator: coloana A', type: 'col', allowTotal: true, showIf: (p) => !p.perVar },
      { k: 'B', label: 'împărțită la B (opțional)', type: 'col', optional: true, showIf: (p) => !p.perVar },
      { k: 'k', label: 'Înmulțește cu k', type: 'text', showIf: (p) => !p.perVar && p.B },
      { k: 'vars', label: 'Variabile', type: 'cols', from: 'vars', showIf: (p) => p.perVar },
      { k: 'fn', label: 'Caută', type: 'select', options: [['max', 'maximul'], ['min', 'minimul']] },
      { k: 'show', label: 'Afișează coloana', type: 'col', from: 'all' },
      { k: 'agr', label: 'Totaluri întâi pe (opțional)', type: 'group', optional: true },
      { k: 'withValue', label: 'Salvează și valoarea indicatorului', type: 'bool', showIf: (p) => !p.perVar },
      { k: 'name', label: 'Numele coloanei rezultat', type: 'text', showIf: (p) => !p.perVar && !p.withValue },
      ...fieldsOut(), F_IDX,
    ],
    defaults: (ctx) => ({ group: ctx.groupCols[0] || '', perVar: false, A: ctx.vars[0] || '', B: '', k: '1', vars: ctx.vars.slice(), fn: 'max', show: ctx.nameCol || '', agr: '', withValue: false, name: 'Localitate', cols2: null }),
    needs: (p, ctx) => [p.group, p.show, p.agr, ...(p.perVar ? p.vars : [...(p.A === '__total__' ? ctx.vars : [p.A]), p.B])],
    gen(p, ctx, n, F) {
      const L = [];
      const g = p.group;
      const idx = p.fn === 'min' ? 'idxmin' : 'idxmax';
      const show = p.show || ctx.nameCol;
      if (p.perVar) {
        const v = `df_cerinta${n}`;
        gapply(L, v, F([...p.vars, show, g]), LP(p.vars, [show, g], ctx), LP(p.vars, [show], ctx), g,
          `lambda x: pd.Series([x.loc[x[v].${idx}(), ${pyStr(show)}] for v in ${V(p.vars, ctx)}], ${V(p.vars, ctx)})`, ctx);
        idxName(L, v, p);
        L.push(saveLine(v, p, ctx, { allowSort: false }));
        return { lines: L };
      }
      const kk = p.k && String(p.k).trim() !== '1' ? ` * ${p.k}` : '';
      const base = `df_c${n}`;
      let ind = p.A;
      const total = p.A === '__total__';
      const aCols = total ? ctx.vars : [p.A];
      const aExpr = (b) => (total ? `${b}[${V(ctx.vars, ctx)}].sum(axis=1)` : `${b}[${pyStr(p.A)}]`);
      const indLine = (b) => (p.B ? `${b}["Indicator"] = ${aExpr(b)}${kk} / ${b}[${pyStr(p.B)}]` : `${b}["Indicator"] = ${aExpr(b)}${kk}`);
      if (p.agr) {
        // ex. pentru fiecare regiune, județul cu cea mai mare valoare: întâi totaluri pe județe
        const extra = uniq([p.B, g, p.agr].filter(Boolean));
        L.push(`${base} = ${F([...aCols, ...extra])}[${LP(aCols, extra, ctx)}].groupby(by=[${pyStr(g)}, ${pyStr(p.agr)}]).sum()`);
        if (p.B || total) { ind = 'Indicator'; L.push(indLine(base)); }
        const v = `s_cerinta${n}`;
        L.push(`${v} = ${base}.groupby(level=0).apply(`);
        L.push(`    func=lambda x: x[${pyStr(ind)}].${idx}()[1])`);
        L.push(`${v}.name = ${pyStr(p.name)}`);
        idxName(L, v, p);
        L.push(saveLine(v, p, ctx, { allowSort: false }));
        return { lines: L };
      }
      let src = F([show, ...aCols, g]);
      if (p.B || total) {
        const extra = uniq([show, p.B, g].filter(Boolean));
        L.push(`${base} = ${F([...aCols, ...extra])}[${LP(aCols, extra, ctx)}].copy()`);
        ind = 'Indicator';
        L.push(indLine(base));
        src = base;
      }
      if (p.withValue) {
        const v = `df_cerinta${n}`;
        gapply(L, v, src, pyList([show, ind, g]), pyList([show, ind]), g, `lambda x: x.loc[x[${pyStr(ind)}].${idx}(), ${pyList([show, ind])}]`, ctx);
        if (p.cols2 && p.cols2.length === 2) L.push(`${v}.columns = ${pyList(p.cols2)}`);
        idxName(L, v, p);
        L.push(saveLine(v, p, ctx, { allowSort: false }));
      } else {
        const v = `s_cerinta${n}`;
        gapply(L, v, src, pyList([show, ind, g]), pyList([show, ind]), g, `lambda x: x.loc[x[${pyStr(ind)}].${idx}(), ${pyStr(show)}]`, ctx);
        L.push(`${v}.name = ${pyStr(p.name)}`);
        idxName(L, v, p);
        L.push(saveLine(v, p, ctx, { allowSort: false }));
      }
      return { lines: L };
    },
  },

  medie_ponderata: {
    title: 'Medie ponderată pe grupuri',
    help: '„Se va calcula media ponderată, folosind ca pondere populația localităților.”',
    helpers: ['calcul_medie'],
    fields: [
      { k: 'group', label: 'Pentru fiecare', type: 'group' },
      { k: 'vars', label: 'Variabile', type: 'cols', from: 'vars' },
      { k: 'w', label: 'Ponderea', type: 'col' },
      { k: 'inter', label: 'Totaluri întâi pe (opțional)', type: 'group', optional: true },
      ...fieldsOut(), F_IDX,
    ],
    defaults: (ctx) => ({ group: ctx.groupCols[0] || '', vars: ctx.vars.slice(), w: popCol(ctx), inter: '' }),
    needs: (p) => [...p.vars, p.w, p.group, p.inter],
    gen(p, ctx, n, F) {
      const L = [];
      const v = `df_cerinta${n}`;
      if (p.inter) {
        const gv = `df_${shortG(p.inter)}${n}`;
        L.push(`${gv} = ${F([...p.vars, p.w, p.group, p.inter])}[${LP(p.vars, [p.w, p.group, p.inter], ctx)}].groupby(by=[${pyStr(p.group)}, ${pyStr(p.inter)}]).sum()`);
        L.push(`${v} = ${gv}.groupby(level=0).apply(func=calcul_medie)`);
      } else {
        gapply(L, v, F([...p.vars, p.w, p.group]), LP(p.vars, [p.w, p.group], ctx), LP(p.vars, [p.w], ctx), p.group, 'calcul_medie', ctx);
      }
      idxName(L, v, p);
      L.push(saveLine(v, p, ctx, { allowSort: false }));
      return { lines: L };
    },
  },

  localizare: {
    title: 'Indici de localizare',
    help: '(ponderea grupului în variabila j) / (ponderea populației grupului în total).',
    fields: [
      { k: 'group', label: 'Pentru fiecare', type: 'group' },
      { k: 'vars', label: 'Variabile', type: 'cols', from: 'vars' },
      { k: 'P', label: 'Populația', type: 'col' },
      ...fieldsOut(), F_IDX,
    ],
    defaults: (ctx) => ({ group: ctx.groupCols[0] || '', vars: ctx.vars.slice(), P: popCol(ctx) }),
    needs: (p) => [...p.vars, p.P, p.group],
    gen(p, ctx, n, F) {
      const L = [];
      const gv = `df_${shortG(p.group)}${n}`;
      const v = `df_cerinta${n}`;
      L.push(`${gv} = ${F([...p.vars, p.P, p.group])}[${LP(p.vars, [p.P, p.group], ctx)}].groupby(by=${pyStr(p.group)}).sum()`);
      L.push(`total${n} = ${gv}.sum()`);
      L.push(`${v} = ${gv}.apply(`);
      L.push(`    func=lambda x: (x[${V(p.vars, ctx)}] / total${n}[${V(p.vars, ctx)}]) / (x[${pyStr(p.P)}] / total${n}[${pyStr(p.P)}]),`);
      L.push(`    axis=1)`);
      idxName(L, v, p);
      L.push(saveLine(v, p, ctx, { allowSort: false }));
      return { lines: L };
    },
  },

  disimilaritate: {
    title: 'Indicele de disimilaritate',
    help: 'D = ½ Σ |xᵢ/Tx − rᵢ/Tr| pe fiecare grup (segregare).',
    helpers: ['disimilaritate'],
    fields: [{ k: 'group', label: 'Pentru fiecare', type: 'group' }, { k: 'vars', label: 'Variabile', type: 'cols', from: 'vars' }, ...fieldsOut(), F_IDX],
    defaults: (ctx) => ({ group: ctx.groupCols[0] || '', vars: ctx.vars.slice() }),
    needs: (p) => [...p.vars, p.group],
    gen(p, ctx, n, F) {
      const L = [];
      const v = `df_cerinta${n}`;
      gapply(L, v, F([...p.vars, p.group]), LP(p.vars, [p.group], ctx), V(p.vars, ctx), p.group, 'disimilaritate', ctx);
      idxName(L, v, p);
      L.push(saveLine(v, p, ctx, { allowSort: false }));
      return { lines: L };
    },
  },

  shannon: {
    title: 'Indicele Shannon-Weaver',
    help: 'H = −Σ pᵢ·log₂ pᵢ pe fiecare grup.',
    helpers: ['shannon'],
    fields: [{ k: 'group', label: 'Pentru fiecare', type: 'group' }, { k: 'vars', label: 'Variabile', type: 'cols', from: 'vars' }, ...fieldsOut(), F_IDX],
    defaults: (ctx) => ({ group: ctx.groupCols[0] || '', vars: ctx.vars.slice() }),
    needs: (p) => [...p.vars, p.group],
    gen(p, ctx, n, F) {
      const L = [];
      const v = `df_cerinta${n}`;
      gapply(L, v, F([...p.vars, p.group]), LP(p.vars, [p.group], ctx), V(p.vars, ctx), p.group, 'shannon', ctx);
      idxName(L, v, p);
      L.push(saveLine(v, p, ctx, { allowSort: false }));
      return { lines: L };
    },
  },

  coef_variatie: {
    title: 'Coeficient de variație pe grupuri',
    help: 'CV = abaterea standard / medie, pentru fiecare variabilă și grup.',
    fields: [{ k: 'group', label: 'Pentru fiecare', type: 'group' }, { k: 'vars', label: 'Variabile', type: 'cols', from: 'vars' }, ...fieldsOut(), F_IDX],
    defaults: (ctx) => ({ group: ctx.groupCols[0] || '', vars: ctx.vars.slice() }),
    needs: (p) => [...p.vars, p.group],
    gen(p, ctx, n, F) {
      const L = [];
      const v = `df_cerinta${n}`;
      L.push(`grupuri${n} = ${F([...p.vars, p.group])}[${LP(p.vars, [p.group], ctx)}].groupby(by=${pyStr(p.group)})`);
      L.push(`${v} = grupuri${n}.std() / grupuri${n}.mean()  # std() din pandas foloseste ddof=1`);
      idxName(L, v, p);
      L.push(saveLine(v, p, ctx, { allowSort: false }));
      return { lines: L };
    },
  },

  top_n: {
    title: 'Primele N rânduri (top)',
    help: 'Ex. „primele 3 localități cu cea mai mare populație”, opțional pentru fiecare grup.',
    fields: [
      { k: 'col', label: 'După coloana', type: 'col' },
      { k: 'N', label: 'N', type: 'text' },
      { k: 'dir', label: 'Ordine', type: 'select', options: [['desc', 'cele mai mari'], ['asc', 'cele mai mici']] },
      { k: 'keep', label: 'Coloane salvate', type: 'cols', from: 'all' },
      { k: 'group', label: 'Pentru fiecare (opțional)', type: 'group', optional: true },
      ...fieldsOut(),
    ],
    defaults: (ctx) => ({ col: ctx.vars[0] || '', N: '3', dir: 'desc', keep: ctx.nameCol ? [ctx.nameCol] : [], group: '' }),
    needs: (p) => [p.col, ...(p.keep || []), p.group],
    gen(p, ctx, n, F) {
      const L = [];
      const v = `df_cerinta${n}`;
      const asc = p.dir === 'asc' ? 'True' : 'False';
      const cols = uniq([...(p.keep || []), p.col]);
      if (p.group) {
        gapply(L, v, F([...cols, p.group]), pyList([...cols, p.group]), pyList(cols), p.group, `lambda x: x.sort_values(by=${pyStr(p.col)}, ascending=${asc}).head(${p.N || 1})`, ctx);
      } else {
        L.push(`${v} = ${F(cols)}[${pyList(cols)}].sort_values(by=${pyStr(p.col)}, ascending=${asc}).head(${p.N || 1})`);
      }
      L.push(saveLine(v, p, ctx, { allowSort: false }));
      return { lines: L };
    },
  },

  valori_lipsa: {
    title: 'Înlocuire valori lipsă',
    help: 'Numeric → media coloanei, text → valoarea cea mai frecventă (nan_replace_df din seminar).',
    helpers: ['nan_replace_df'],
    fields: [{ k: 'out', label: 'Salvează în (opțional)', type: 'text' }],
    defaults: () => ({ out: '' }),
    needs: () => [],
    gen(p, ctx, n) {
      const L = [`nan_replace_df(${ctx.mainVar})`];
      if (p.out) L.push(`${ctx.mainVar}.to_csv(${pyStr(ctx.dirOut + p.out)})`);
      return { lines: L };
    },
  },

  pivot: {
    title: 'Tabel pivot',
    help: 'Ex. „județele pe linii și anii pe coloane” (seminarul 1).',
    fields: [
      { k: 'index', label: 'Pe linii', type: 'col', from: 'raw' },
      { k: 'columns', label: 'Pe coloane', type: 'col', from: 'raw' },
      { k: 'values', label: 'Valori', type: 'col', from: 'raw' },
      { k: 'nan', label: 'Înlocuiește valorile lipsă cu media coloanei', type: 'bool' },
      { k: 'out', label: 'Salvează în (opțional)', type: 'text' },
    ],
    defaults: (ctx) => ({ index: ctx.main.header[0], columns: ctx.main.header[1], values: ctx.main.header[ctx.main.header.length - 1], nan: false, out: '' }),
    needs: () => [],
    gen(p, ctx, n) {
      const L = [];
      const v = `df_cerinta${n}`;
      L.push(`${v} = ${ctx.mainVar}.pivot_table(index=${pyStr(p.index)}, columns=${pyStr(p.columns)}, values=${pyStr(p.values)})`);
      const helpers = [];
      if (p.nan) { L.push(`nan_replace_df(${v})`); helpers.push('nan_replace_df'); }
      if (p.out) L.push(`${v}.to_csv(${pyStr(ctx.dirOut + p.out)})`);
      return { lines: L, helpers };
    },
  },

  cov_corr_std: {
    title: 'Covarianță / corelație / standardizare',
    help: 'Matricea de covarianță (V), de corelație (R) și datele standardizate (seminarul 1).',
    fields: [
      { k: 'src', label: 'Datele', type: 'src' },
      { k: 'what', label: 'Calculează', type: 'multi', options: [['cov', 'covarianța'], ['corr', 'corelația'], ['std', 'standardizarea']] },
      { k: 'outs', label: 'Fișiere', type: 'outs' },
    ],
    defaults: () => ({ src: 'main', what: ['corr'], outs: { cov: 'V.csv', corr: 'R.csv', std: 'x_std.csv' } }),
    needs: (p, ctx) => (p.src === 'main' ? ctx.vars : []),
    gen(p, ctx, n) {
      const L = [];
      const helpers = [];
      let df, vlist;
      if (p.src && p.src !== 'main') {
        df = `df_cerinta${p.src}`;
        vlist = `variabile${n}`;
        L.push(`${vlist} = list(${df})`);
      } else { df = ctx.mainVar; vlist = ctx.varsName; }
      L.push(`x = ${df}[${vlist}].values`);
      if (p.src === 'main' && ctx.hasNaN) { L.push('x = nan_replace(x)'); helpers.push('nan_replace'); }
      const outs = p.outs || {};
      for (const w of p.what || []) {
        if (w === 'cov') L.push('v = np.cov(x, rowvar=False)', `df_cov = pd.DataFrame(v, ${vlist}, ${vlist})`, `df_cov.to_csv(${pyStr(ctx.dirOut + (outs.cov || 'V.csv'))})`);
        if (w === 'corr') L.push('r = np.corrcoef(x, rowvar=False)', `df_r = pd.DataFrame(r, ${vlist}, ${vlist})`, `df_r.to_csv(${pyStr(ctx.dirOut + (outs.corr || 'R.csv'))})`);
        if (w === 'std') { L.push('x_std = standardize(x)', `df_x_std = pd.DataFrame(x_std, ${df}.index, ${vlist})`, `df_x_std.to_csv(${pyStr(ctx.dirOut + (outs.std || 'x_std.csv'))})`); helpers.push('standardize'); }
      }
      return { lines: L, helpers };
    },
  },

  acp: {
    title: 'ACP (analiza în componente principale)',
    help: 'Varianța componentelor, corelații factoriale, scoruri, cosinusuri, contribuții, comunalități (seminarele 4–5).',
    helpers: ['acp', 'tabelare_varianta', 'tabelare_salvare_matrice'],
    fields: [
      { k: 'parts', label: 'Ce calculează', type: 'multi', options: [['varianta', 'varianța'], ['corelatii', 'corelații factoriale'], ['scoruri', 'scoruri'], ['cosinusuri', 'cosinusuri'], ['contributii', 'contribuții'], ['comunalitati', 'comunalități']] },
      { k: 'std', label: 'Date standardizate', type: 'bool' },
      { k: 'plots', label: 'Cu grafice (ca la seminar)', type: 'bool' },
      { k: 'outs', label: 'Fișiere', type: 'outs' },
    ],
    defaults: () => ({ parts: ['varianta'], std: true, plots: true, outs: {} }),
    needs: (p, ctx) => ctx.vars,
    gen(p, ctx, n) {
      const L = [];
      const helpers = [];
      const o = p.outs || {};
      const out = (k, d) => o[k] || d;
      if (!ctx.acpDone) {
        L.push(`x = ${ctx.mainVar}[${ctx.varsName}].values`);
        L.push(`x_, r_v, alpha, a, c, r = acp(x${p.std === false ? ', std=False' : ''})`);
        L.push(`etichete_c = ["C" + str(i + 1) for i in range(len(alpha))]`);
        ctx.acpDone = true;
      }
      const parts = p.parts || [];
      if (p.plots) { helpers.push('show'); ctx.needShow = true; }
      if (parts.includes('varianta')) {
        L.push('df_varianta = tabelare_varianta(alpha)', `df_varianta.round(3).to_csv(${pyStr(ctx.dirOut + out('varianta', 'Varianta.csv'))})`);
        if (p.plots) { L.push('k = plot_varianta(alpha)', 'nr_componente = min(v for v in k if v is not None)', 'print("Numar componente semnificative:", nr_componente)'); helpers.push('plot_varianta'); }
      }
      if (parts.includes('corelatii')) {
        L.push(`df_r = tabelare_salvare_matrice(r, ${ctx.varsName}, etichete_c, "Variabile", ${pyStr(out('corelatii', 'r.csv'))})`);
        if (p.plots) { L.push('corelograma(df_r)', 'plot_scoruri_corelatii(df_r, titlu="Corelatii factoriale", scoruri=False)'); helpers.push('corelograma', 'plot_scoruri_corelatii'); }
      }
      if (parts.includes('scoruri')) {
        L.push('s = c / np.sqrt(alpha)', `df_s = tabelare_salvare_matrice(s, ${ctx.mainVar}.index, etichete_c, ${ctx.mainVar}.index.name, ${pyStr(out('scoruri', 's.csv'))})`);
        if (p.plots) { L.push('plot_scoruri_corelatii(df_s)'); helpers.push('plot_scoruri_corelatii'); }
      }
      if (parts.includes('cosinusuri') || parts.includes('contributii')) L.push('c2 = c * c');
      if (parts.includes('cosinusuri')) L.push('cosin = (c2.T / np.sum(c2, axis=1)).T', `tabelare_salvare_matrice(cosin, ${ctx.mainVar}.index, etichete_c, ${ctx.mainVar}.index.name, ${pyStr(out('cosinusuri', 'cosin.csv'))})`);
      if (parts.includes('contributii')) L.push('contrib = c2 * 100 / np.sum(c2, axis=0)', `tabelare_salvare_matrice(contrib, ${ctx.mainVar}.index, etichete_c, ${ctx.mainVar}.index.name, ${pyStr(out('contributii', 'contrib.csv'))})`);
      if (parts.includes('comunalitati')) {
        L.push('comm = np.cumsum(r * r, axis=1)', `df_comm = tabelare_salvare_matrice(comm, ${ctx.varsName}, etichete_c, "Variabile", ${pyStr(out('comunalitati', 'comm.csv'))})`);
        if (p.plots) { L.push('corelograma(df_comm, titlu="Comunalitati", vmin=0, cmap="Blues")'); helpers.push('corelograma'); }
      }
      return { lines: L, helpers };
    },
  },

  custom: {
    title: 'Cod scris de mână',
    help: 'Pentru cerințele pe care nu le recunosc: scrie codul aici și îl pun în script.',
    fields: [{ k: 'code', label: 'Cod Python', type: 'code' }],
    defaults: () => ({ code: '' }),
    needs: () => [],
    gen(p) { return { lines: String(p.code || '').replace(/\s+$/, '').split('\n') }; },
  },
};
export const TEMPLATE_ORDER = ['indicator_rand', 'filtru', 'rata_grup', 'max_in_grup', 'argmax_coloane', 'medie_ponderata', 'agregare', 'procente', 'indicator_variabile', 'localizare', 'disimilaritate', 'shannon', 'coef_variatie', 'top_n', 'valori_lipsa', 'pivot', 'cov_corr_std', 'acp', 'custom'];

// ───────────────────────── generarea scriptului ─────────────────────────
function wrap(line, max = 110) {
  if (line.length <= max) return line;
  const k = line.indexOf('.merge(');
  if (k > 0) return line.slice(0, k + 7) + '\n    ' + line.slice(k + 7);
  return line;
}

export function generate(ctx, reqs, S = {}) {
  const warn = [];
  if (!ctx.main || !ctx.main.header.length) {
    return { files: { 'main.py': '# Lipește textul subiectului în stânga (sau încarcă fișierele CSV)\n# și codul apare aici.\n' }, warn, plan: { steps: [], missing: [] } };
  }
  const fixDir = (d) => { const t = String(d ?? '').trim().replace(/\\/g, '/'); return t && !t.endsWith('/') ? t + '/' : t; };
  ctx.dirIn = fixDir(S.dirIn ?? 'data_in/');
  ctx.dirOut = fixDir(S.dirOut ?? 'data_out/');
  ctx.ig = S.includeGroups !== false;
  ctx.acpDone = false;
  ctx.needShow = false;
  for (const f of ctx.files) if (f !== ctx.main) f.indexCol = f.firstUnique ? 0 : null;

  const inMain = new Set([...(ctx.idx ? [ctx.idx] : []), ...ctx.cols]);
  const extra = [];
  for (const r of reqs) {
    const T = TEMPLATES[r.type];
    if (!T) continue;
    for (const c of T.needs(r.params, ctx) || []) if (c && !String(c).startsWith('__') && !inMain.has(c) && !extra.includes(c)) extra.push(c);
  }
  const plan = extra.length ? planMerges(ctx, extra) : { steps: [], missing: [] };
  if (plan.missing.length) warn.push(`Nu știu din ce fișier vin coloanele ${plan.missing.join(', ')}. Încarcă fișierul care le conține.`);
  const F = (cols) => (cols.filter(Boolean).every((c) => String(c).startsWith('__') || inMain.has(c)) || !plan.steps.length ? ctx.mainVar : ctx.locVar);

  const helpers = new Set();
  const preNan = !reqs.some((r) => r.type === 'valori_lipsa' || r.type === 'pivot' || r.type === 'acp') && (S.nan === 'on' || (S.nan !== 'off' && ctx.hasNaN));
  const acpNan = reqs.some((r) => r.type === 'acp') && !reqs.some((r) => r.type === 'valori_lipsa') && ctx.hasNaN && S.nan !== 'off';
  if (preNan || acpNan) helpers.add('nan_replace_df');
  const body = [];
  for (const r of reqs) {
    const T = TEMPLATES[r.type];
    let lines;
    try {
      const res = T.gen(r.params, ctx, r.id, F);
      lines = res.lines;
      (T.helpers || []).forEach((x) => helpers.add(x));
      (res.helpers || []).forEach((x) => helpers.add(x));
    } catch (e) {
      lines = [`# nu am putut genera codul: ${e.message}`];
    }
    r.code = [`# ${r.id}`, ...lines.map((l) => wrap(l))].join('\n');
    body.push(r.code);
  }
  if (ctx.needShow) body.push('show()');

  // citiri + merge
  const sep = (f) => (!f.delim || f.delim === ',' ? '' : f.delim === '\t' ? ', sep="\\t"' : `, sep=${pyStr(f.delim)}`);
  const read = [];
  const m = ctx.main;
  read.push(`${ctx.mainVar} = pd.read_csv(${pyStr(ctx.dirIn + m.name)}${m.indexCol === 0 ? ', index_col=0' : ''}${sep(m)})`);
  if (preNan || acpNan) read.push(`nan_replace_df(${ctx.mainVar})`);
  const usesVars = new RegExp(`\\b${ctx.varsName}\\b`).test(body.join('\n'));
  if (ctx.vars.length && (usesVars || !reqs.length)) read.push(`${ctx.varsName} = ${ctx.varsExpr}`);
  const merges = [];
  for (const st of plan.steps) {
    const f = st.file;
    read.push(`${f.varName} = pd.read_csv(${pyStr(ctx.dirIn + f.name)}, index_col=${st.fKey}${sep(f)})`);
    if (st.caseFix) read.push(`${f.varName}.index = ${f.varName}.index.str.${st.caseFix}()  # codurile difera ca litere mari/mici`);
    const right = st.select ? `${f.varName}[${pyList(st.select)}]` : f.varName;
    const left = merges.length ? ctx.locVar : ctx.mainVar;
    const on = st.leftOn ? `left_on=${pyStr(st.leftOn)}, right_index=True` : 'left_index=True, right_index=True';
    merges.push(wrap(`${ctx.locVar} = ${left}.merge(${right}, ${on})`));
  }

  // importuri + funcții
  const split = !!S.split;
  const plotH = HELPER_ORDER.filter((x) => helpers.has(x) && PLOT_HELPERS.has(x));
  const funcH = HELPER_ORDER.filter((x) => helpers.has(x) && !PLOT_HELPERS.has(x));
  const helperSrc = (x) => HELPERS[x].replace('__OUT__', ctx.dirOut);
  const usesSys = helpers.has('acp') || reqs.some((r) => r.type === 'cov_corr_std');
  const head = [];
  if (S.mkdir !== false) head.push('import os');
  if (usesSys) head.push('import sys');
  if (head.length) head.push('');
  head.push('import numpy as np', 'import pandas as pd');
  if (!split && funcH.includes('nan_replace_df')) head.push('from pandas.api.types import is_numeric_dtype');
  if (!split && plotH.length) head.push('import matplotlib.pyplot as plt', 'from seaborn import heatmap');
  if (split && funcH.length) head.push('', `from functii import ${funcH.join(', ')}`);
  if (split && plotH.length) head.push(`from grafice import ${plotH.join(', ')}`);
  head.push('', "pd.set_option('display.max_columns', None)");
  if (usesSys) head.push('np.set_printoptions(suppress=True, precision=3, threshold=sys.maxsize)');
  if (S.mkdir !== false && ctx.dirOut.replace(/\/$/, '')) head.push(`os.makedirs(${pyStr(ctx.dirOut.replace(/\/$/, ''))}, exist_ok=True)`);

  const parts = [head.join('\n')];
  if (!split && (funcH.length || plotH.length)) parts.push([...funcH, ...plotH].map(helperSrc).join('\n\n\n'));
  parts.push([...read, ...(merges.length ? ['', ...merges] : [])].join('\n'));
  parts.push(body.join('\n\n'));
  const files = { 'main.py': parts.join(split ? '\n\n' : '\n\n\n').replace(/\n{4,}/g, '\n\n\n') + '\n' };
  if (split && funcH.length) {
    const fh = ['import numpy as np', 'import pandas as pd'];
    if (funcH.includes('nan_replace_df')) fh.push('from pandas.api.types import is_numeric_dtype');
    files['functii.py'] = fh.join('\n') + '\n\n\n' + funcH.map(helperSrc).join('\n\n\n') + '\n';
  }
  if (split && plotH.length) {
    files['grafice.py'] = 'import matplotlib.pyplot as plt\nimport numpy as np\nimport pandas as pd\nfrom seaborn import heatmap\n\n\n' + plotH.map(helperSrc).join('\n\n\n') + '\n';
  }
  return { files, warn, plan };
}

// ───────────────────────── verificarea cu exemplul ─────────────────────────
function cellEq(e, g) {
  e = String(e ?? '').trim(); g = String(g ?? '').trim();
  if (e === g) return 'ok';
  if (isNumStr(e) && isNumStr(g)) {
    const a = +e, b = +g;
    if (Math.abs(a - b) <= Math.max(1e-9, Math.abs(a) * 1e-9)) return 'ok';
    const dec = (e.split('.')[1] || '').length;
    if (dec < 10 && Math.abs(a - b) <= 10 ** -dec + 1e-12) return 'ok';
    return 'no';
  }
  return norm(e) === norm(g) ? 'case' : 'no';
}
export function compareOutput(example, text) {
  const { header, rows } = parseCSV(text);
  const got = header.map((s) => s.trim());
  const hOk = example.header.length === got.length && example.header.every((h, i) => norm(h) === norm(got[i]));
  const res = { header: { exp: example.header, got, ok: hOk }, rows: [], nRows: rows.length };
  example.rows.forEach((er, i) => {
    const gr = rows[i] || [];
    const cells = er.map((v, j) => cellEq(v, gr[j]));
    let ok = er.length === gr.length && cells.every((c) => c !== 'no');
    let note = '';
    if (!ok) {
      const k = rows.findIndex((r) => r.length === er.length && er.every((v, j) => cellEq(v, r[j]) !== 'no'));
      if (k >= 0) note = `rândul există, dar e pe poziția ${k + 1} (verifică sortarea)`;
      else if (rows.some((r) => String(r[0]).trim() === String(er[0]).trim())) note = 'același rând are alte valori';
    }
    res.rows.push({ exp: er, got: gr, cells, ok, note });
  });
  res.ok = hOk && res.rows.every((r) => r.ok);
  return res;
}

// ───────────────────────── evidențiere sintaxă Python ─────────────────────────
const PY_KW = new Set('False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'.split(' '));
const PY_BI = new Set('print len range list dict set tuple sum min max abs round sorted zip enumerate str int float isinstance type super'.split(' '));
export function highlightPy(src) {
  const re = /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)|([A-Za-z_]\w*)/g;
  let out = '', last = 0, m, prevWord = '';
  while ((m = re.exec(src))) {
    out += esc(src.slice(last, m.index));
    if (m[1]) out += `<span class="t-com">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span class="t-str">${esc(m[2])}</span>`;
    else if (m[3]) out += `<span class="t-num">${m[3]}</span>`;
    else {
      const w = m[4];
      const after = src.slice(re.lastIndex).match(/^\s*(\(|=(?!=))?/)[1];
      let before = m.index - 1;
      while (before >= 0 && /[ \t\n]/.test(src[before])) before--;
      const bc = src[before];
      if (PY_KW.has(w)) out += `<span class="t-kw">${w}</span>`;
      else if (prevWord === 'def') out += `<span class="t-def">${w}</span>`;
      else if (after === '=' && (bc === '(' || bc === ',')) out += `<span class="t-arg">${w}</span>`;
      else if (after === '(' && PY_BI.has(w)) out += `<span class="t-bi">${w}</span>`;
      else out += esc(w);
      prevWord = w;
    }
    if (!m[4]) prevWord = '';
    last = re.lastIndex;
  }
  return out + esc(src.slice(last));
}
