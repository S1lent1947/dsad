/* Rulează codul Python direct în browser, cu Pyodide (pandas 2.2, numpy, matplotlib). */
const VER = '0.27.7';
const BASE = `https://cdn.jsdelivr.net/pyodide/v${VER}/full/`;
const W = '/home/pyodide/dsad';

let pyP = null;
let seabornP = null;

function loadScript(src) {
  return new Promise((ok, bad) => {
    if (globalThis.loadPyodide) return ok();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = ok;
    s.onerror = () => bad(new Error('Nu am putut descărca Python pentru browser. Verifică conexiunea la internet.'));
    document.head.appendChild(s);
  });
}

export function getPy(status = () => {}) {
  if (!pyP) {
    pyP = (async () => {
      status('Descarc Python pentru browser (doar prima dată, durează câteva secunde)…');
      await loadScript(BASE + 'pyodide.js');
      const py = await globalThis.loadPyodide({ indexURL: BASE });
      status('Încarc pandas și numpy…');
      await py.loadPackage(['numpy', 'pandas']);
      return py;
    })();
    pyP.catch(() => { pyP = null; });
  }
  return pyP;
}

const strip = (d) => String(d || '').replace(/^\.?\/+/, '').replace(/\/+$/, '');

function cleanTrace(msg) {
  const lines = String(msg).split('\n');
  const where = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*File "(?:[^"]*\/)?(main|functii|grafice)\.py", line (\d+)/);
    if (m) {
      where.push(`${m[1]}.py, linia ${m[2]}`);
      const src = lines[i + 1];
      if (src && !/^\s*File /.test(src) && src.trim()) where.push('    ' + src.trim());
    }
  }
  const last = lines.map((l) => l.trim()).filter(Boolean).pop() || String(msg);
  return { where: where.join('\n'), last };
}

export function hintFor(last) {
  const s = String(last || '');
  if (/include_groups/.test(s)) return 'Ai pandas mai vechi de 2.2: debifează „include_groups=False” din setări.';
  if (/KeyError/.test(s)) return 'O coloană nu există cu numele ăsta. Verifică antetul CSV (litere mari/mici, spații). După merge, coloanele cu același nume primesc sufixele _x și _y.';
  if (/FileNotFoundError/.test(s)) return 'Fișierul nu e unde îl caută codul. Verifică folderul (data_in/) și numele exact al fișierului.';
  if (/non-existent directory|Cannot save file/.test(s)) return 'Folderul pentru rezultate nu există. Bifează „Creează folderul de rezultate” sau creează-l în proiect.';
  if (/could not convert|unsupported operand|can't multiply|must be real number, not str/.test(s)) return 'Calculul a prins și o coloană text. Lista de variabile trebuie să conțină doar coloane numerice.';
  if (/argmax of an empty|argmin of an empty|All-NaN|attempt to get arg|empty sequence/.test(s)) return 'Un grup nu are valori valide (de exemplu o împărțire la 0). Filtrează rândurile înainte.';
  if (/Weights sum to zero|ZeroDivision/.test(s)) return 'Ponderile dintr-un grup au suma 0. Verifică coloana folosită ca pondere.';
  if (/ModuleNotFoundError/.test(s)) return 'Lipsește un modul. Aici merg numpy, pandas, matplotlib și seaborn; pe calculatorul tău instalează-l cu pip.';
  if (/IndentationError|SyntaxError/.test(s)) return 'Greșeală de scriere în cod (indentare, paranteză sau ghilimele).';
  return '';
}

/**
 * files: [{name, text}] puse în folderul de intrare
 * code: {'main.py': '...', 'functii.py': '...'}
 */
export async function runPython({ files, code, dirIn = 'data_in/', dirOut = 'data_out/' }, status = () => {}) {
  const py = await getPy(status);
  const all = Object.values(code).join('\n');
  const plots = /matplotlib|seaborn|from\s+grafice|import\s+grafice/.test(all);
  if (plots) {
    status('Încarc matplotlib…');
    await py.loadPackage(['matplotlib']);
    if (/seaborn/.test(all)) {
      if (!seabornP) {
        seabornP = (async () => {
          await py.loadPackage('micropip');
          status('Instalez seaborn…');
          await py.pyimport('micropip').install('seaborn');
        })();
        seabornP.catch(() => { seabornP = null; });
      }
      await seabornP;
    }
  }
  try { await py.loadPackagesFromImports(all); } catch { /* eroarea reală apare la rulare */ }

  status('Rulez codul…');
  const out = [];
  py.setStdout({ batched: (s) => out.push(s) });
  py.setStderr({ batched: (s) => out.push(s) });
  py.globals.set('_W', W);
  py.runPython(`
import os, shutil, sys
os.chdir("/")
shutil.rmtree(_W, ignore_errors=True)
os.makedirs(_W)
os.chdir(_W)
if _W not in sys.path:
    sys.path.insert(0, _W)
for _m in ("functii", "grafice"):
    sys.modules.pop(_m, None)
`);
  const din = strip(dirIn);
  const dout = strip(dirOut);
  const inDir = din ? `${W}/${din}` : W;
  py.FS.mkdirTree(inDir);
  for (const f of files) py.FS.writeFile(`${inDir}/${f.name}`, f.text);
  if (dout) py.FS.mkdirTree(`${W}/${dout}`);
  for (const [name, src] of Object.entries(code)) py.FS.writeFile(`${W}/${name}`, src);

  let error = null;
  const t0 = performance.now();
  try {
    await py.runPythonAsync(`
${plots ? `import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
plt.close("all")
plt.show = lambda *a, **k: None
` : ''}import runpy
runpy.run_path("main.py", run_name="__main__")
`);
  } catch (e) {
    error = cleanTrace(e && e.message ? e.message : e);
  }
  const ms = performance.now() - t0;

  const outputs = [];
  const outDir = dout ? `${W}/${dout}` : W;
  const skip = new Set([...Object.keys(code), ...(din ? [] : files.map((f) => f.name))]);
  let names = [];
  try { names = py.FS.readdir(outDir).filter((n) => n !== '.' && n !== '..'); } catch { names = []; }
  for (const n of names.sort()) {
    if (skip.has(n) || !/\.(csv|txt)$/i.test(n)) continue;
    try { outputs.push({ name: n, text: py.FS.readFile(`${outDir}/${n}`, { encoding: 'utf8' }) }); } catch { /* ignor */ }
  }

  let figures = [];
  if (plots) {
    try {
      const px = py.runPython(`
import io, base64
import matplotlib.pyplot as plt
_imgs = []
for _n in plt.get_fignums():
    _b = io.BytesIO()
    plt.figure(_n).savefig(_b, format="png", dpi=80, bbox_inches="tight")
    _imgs.append(base64.b64encode(_b.getvalue()).decode())
plt.close("all")
_imgs
`);
      figures = px.toJs();
      px.destroy();
    } catch { figures = []; }
  }
  return { ok: !error, error, stdout: out.join('\n'), outputs, figures, ms };
}
