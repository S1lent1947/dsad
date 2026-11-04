# dsad.py

Site pentru DSAD: lipești textul subiectului și primești codul pandas scris ca la seminar. Îl poți rula direct în browser și îl verifici cu exemplele din enunț.

**Site:** https://s1lent1947.github.io/dsad/

## Ce face

- **Rezolvă**: recunoaște cerințele și scrie `main.py` (și `functii.py`, dacă vrei). Tipuri acoperite: filtrări, rapoarte pe rând, rate la 1000 de locuitori, procente, maximul pe grup, activitatea dominantă, totaluri și medii pe grupuri, medii ponderate, indici de localizare, disimilaritate, Shannon, coeficient de variație, top N, valori lipsă, pivot, covarianță/corelație/standardizare, ACP.
- Cu fișierele CSV încărcate, numele coloanelor sunt exacte și codul rulează în browser (Pyodide). Fișierele nu pleacă de pe calculator.
- **Rezolvări**: seminarele 1–5, temele 2.1 și 2.4 și testul cu I2014, explicate pe cerințe.
- **Fițuică**: ce trebuie din pandas și numpy, cu căutare.

## Plugin pentru PyCharm

1. Descarcă [`plugin/dsad-pycharm.zip`](plugin/dsad-pycharm.zip) (nu îl dezarhiva).
2. În PyCharm: **File → Settings → Plugins**, rotița de lângă **Installed** → **Install Plugin from Disk…** → alege zip-ul.
3. Deschide panoul **DSAD** din dreapta. Citește CSV-urile și PDF-ul subiectului din proiect, iar **Scrie main.py în proiect și rulează** pune codul în proiect și îl pornește.

Merge pe PyCharm 2022.3 sau mai nou. Sursa e în `plugin/src`. Construire: `python plugin/build.py "<folderul PyCharm>"`.

## Structura

- `index.html`, `assets/`: site-ul (fișiere statice, fără build)
- `rezolvari/`: rezolvările scrise de mână
- `data/`: datele de la seminar, pentru exemple
- `plugin/`: pluginul pentru PyCharm (sursă + `dsad-pycharm.zip`)
