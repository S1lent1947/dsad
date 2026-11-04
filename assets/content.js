/* Conținut: subiecte de exemplu, rezolvări explicate, fițuica pandas. */

const T_I2014 = `În fișierul I2014.csv se află informații privind activitatea firmelor în anul 2014 la nivel de localitate. Informațiile sunt următoarele:
Siruta - Codul Siruta al localității;
DenLocalitate - Denumirea localității;
NrFirme, NrSal, TotalCifraAfaceri, TotalProfit, TotalPierdere - Valorile reprezentând numărul de firme, numărul de angajați, total cifra de afaceri, total profit și total pierdere.
În fișierul PopulatieLocalitati.csv se află codurile Siruta, indicativele de județ și populația pentru fiecare localitate.

Cerințe și barem:
1. Să se salveze în fișierul Output1.csv raportul dintre cifra de afaceri și numărul de salariați pentru fiecare localitate unde există salariați. Datele vor fi salvate în ordinea descrescătoare a acestui raport. Pentru fiecare localitate se va afișa codul Siruta, denumirea localității și raportul dintre cifra de afaceri și numărul de salariați. (2 puncte)
Exemplu
Siruta,DenLocalitate,Raport CA/NrSal
93771,Independenta,2444763.184
60507,Oras Navodari,2444151.356
...

2. Să se calculeze rata ocupării populației ca număr de salariați la 1000 locuitori pentru fiecare județ. Datele vor fi salvate în ordinea descrescătoare a ratei, în fișierul Output2.csv. Pentru fiecare județ se va afișa indicativul de județ și rata ocupării. (2 puncte)
Exemplu
Judet,Rata Ocuparii
B,513.8058810884887
IF,374.32818563436416
TM,249.36274846084416
...

3. Să se determine pentru fiecare județ localitatea cu cel mai mare profit pe locuitor și să se salveze în fișierul Output3.csv. Pentru fiecare județ se va salva indicativul de județ și denumirea localității cerute. (2 puncte)
Judet,Localitate
AB,Galda De Jos
...

4. Să se calculeze valorile medii ale indicatorilor la nivel de județ (media localităților din județ) și să se salveze în fișierul Output4.csv. Se va calcula media ponderată, folosind ca pondere populația localităților. Pentru fiecare județ se va afișa indicativul de județ și cele 5 medii. (3 puncte)
Exemplu
Judet,NrFirme,NrSal,TotalCifraAfaceri,TotalProfit,TotalPierdere
AB,946.407,5690.334,1336997181.357,113378467.612,31730528.39
...

1 punct din oficiu`;

const T_24 = `În fișierul IndustriaAlimentara.csv se află informații privind numărul de angajați în industria alimentară la nivel de localitate. Informațiile sunt următoarele:
Siruta - Codul Siruta al localității;
Localitate - Denumirea localității;
Carne, Peste, LegumeFructe, Uleiuri, Lactate, Morarit, Panificatie - Valorile reprezentând numărul de angajați pe principalele activități din industria alimentară.
În fișierul PopulatieLocalitati.csv se află populația pe localități și indicativele de județ pentru fiecare localitate. În fișierul Coduri_Judete.csv este specificată apartenența la regiune pentru fiecare județ.

Cerințe:
1. Să se salveze în fișierul Cerinta1.csv datele privind numărul de angajați pe activitățile din industria alimentară, pentru localitățile în care numărul de angajați este mai mare decât 0. Fișierul Cerinta1.csv va avea aceleași coloane ca fișierul IndustriaAlimentara.csv.
Exemplu
Siruta,Localitate,Carne,Peste,LegumeFructe,Uleiuri,Lactate,Morarit,Panificatie
57350,Cojocna,0.0,0.0,0.0,0.0,1.0,0.0,0.0
...
2. Să se calculeze și să se salveze în fișierul Cerinta2.csv, procentul de angajați pe fiecare activitate la nivel de localitate. Dacă numărul total de angajați este 0, procentele vor fi 0. Vor fi salvate codul Siruta, numele localității și procentele pentru fiecare localitate.
Exemplu
Siruta,Localitate,Carne,Peste,LegumeFructe,Uleiuri,Lactate,Morarit,Panificatie
32768,Budesti,0.0,0.0,0.0,0.0,0.0,0.0,0.0
...
3. Să se salveze în fișierul Cerinta3.csv județele sortate descrescător după ponderea angajaților din industria alimentară în populația totală. Se va salva pentru fiecare județ, indicativul și ponderea industriei alimentare.
Exemplu
Judet,Ponderi
if,0.017788851398883143
...
4. Să se salveze în fișierul Cerinta4.csv, activitatea cu cei mai mulți angajați la nivel de județ. Se va afișa indicativul de județ și activitatea dominantă.
Exemplu
Judet,Activitate
ab,Carne
...
5. Să se salveze în fișierul Cerinta5.csv numărul mediu de angajați pe fiecare activitate la nivel de regiune. Se va calcula media ponderată, folosind ca pondere populația localităților.
Exemplu
Regiune,Carne,Peste,LegumeFructe,Uleiuri,Lactate,Morarit,Panificatie
Bucuresti-Ilfov,
2516.507241672197,330.4067432568632,1283.9654215356093,387.2487577642238,532.082127655
4866,760.203802718469,5413.520212398902
...
6. Să se calculeze și să se afișeze în fișierul Cerinta6.csv indicii de localizare la nivel de județ pentru fiecare activitate. Un indice de localizare se calculează ca raport între ponderea județului i în activitatea j la nivel național și ponderea populației din județul i în totalul populației.
De exemplu dacă pentru județul x numărul de angajați în industria cărnii este de 3000 de persoane și populația este de 200000 de locuitori, iar la nivel național numărul de angajați în industria cărnii este de 100000 de persoane iar populația țării este de 20000000 locuitori, indicele de localizare pentru industria cărnii în județul x este: (3000/100000)/(200000/20000000) = 3.
Exemplu
Judet,Carne,Peste,LegumeFructe,Uleiuri,Lactate,Morarit,Panificatie
ab,3.188383891910333,4.891793337941724,0.1324839720970428,0.01758474402299803,5.354642
2246082175,0.513386058398296,0.8566490275582636
...
Observație
Media ponderată pentru o serie de observații xi și ponderi pi se calculează după relația: x = Σ xi·pi.`;

const T_21 = `Tema 2.1
În fișierul Etnicity.csv se află date privind populația pe etnii la nivelul localităților conform Recensământului Populației și Locuințelor din 2011. În fișierele Coduri_Localitati.csv, Coduri_Judete.csv și Coduri_Regiuni.csv sunt codificările localităților, județelor, regiunilor și macroregiunilor României.
1. Să se calculeze și să se salveze populația pe etnii la nivelul județelor, regiunilor și macroregiunilor
2. Să se calculeze și să se salveze procentele pe etnii la nivelul localităților, județelor, regiunilor și macroregiunilor
3. Să se calculeze și să se salveze indicii de segregare etnică la nivelul județelor. Vor fi utilizați următorii indici:
Indicele de disimilaritate, D = 1/2 Σ |xi/Tx − ri/Tr|
Shannon-Weaver, H = − Σ pi log2 pi
unde i este unitatea administrativ-teritorială (UAT), n este numărul de unități administrativ-teritoriale, xi este populația de o anumită etnie, ri este restul populației, Tx este totalul populației de etnia respectivă, Tr este totalul restului populației, pi este ponderea etniei la nivelul unității administrativ-teritoriale i față de totalul etniei.`;

const T_S1 = `În fișierul Natalitate_Ro.csv se află numărul de născuți vii pe județe și ani (coloanele Judete, Localitati, Ani, UM: Numar persoane, Valoare). Unele valori lipsesc.

Cerințe:
1. Să se construiască tabelul cu județele pe linii și anii pe coloane (pivot) și să se înlocuiască valorile lipsă cu media pe coloană.
2. Să se calculeze și să se salveze matricea de covarianță în fișierul V.csv.
3. Să se calculeze și să se salveze matricea de corelație în fișierul R.csv.
4. Să se standardizeze datele și să se salveze în fișierul x_std.csv.`;

const T_ACP = `În fișierul ConsumAlimentar.csv se află ponderea fiecărei categorii alimentare în totalul alimentelor disponibile pentru consum, pentru fiecare țară. Coloanele sunt Country, Code și 11 categorii alimentare.

Cerințe:
1. Să se înlocuiască valorile lipsă cu media pe coloană.
2. Să se efectueze analiza în componente principale pe datele standardizate și să se salveze varianța componentelor în fișierul Varianta.csv. Să se traseze graficul varianței.
3. Să se calculeze corelațiile factoriale și să se salveze în fișierul r.csv. Să se traseze corelograma.
4. Să se calculeze scorurile și să se salveze în fișierul s.csv.
5. Să se calculeze cosinusurile și să se salveze în fișierul cosin.csv.
6. Să se calculeze contribuțiile observațiilor și să se salveze în fișierul contrib.csv.
7. Să se calculeze comunalitățile și să se salveze în fișierul comm.csv.`;

export const PRESETS = [
  { id: 'i2014', label: 'Testul I2014', text: T_I2014, files: [] },
  { id: 'tema24', label: 'Tema 2.4', text: T_24, files: ['data/sem3/IndustriaAlimentara.csv', 'data/sem3/PopulatieLocalitati.csv', 'data/sem3/Coduri_Judete.csv'] },
  { id: 'tema21', label: 'Tema 2.1', text: T_21, files: ['data/sem2/Ethnicity.csv', 'data/sem2/Coduri_Localitati.csv', 'data/sem2/Coduri_Judete.csv', 'data/sem2/Coduri_Regiuni.csv'] },
  { id: 'sem1', label: 'Seminarul 1', text: T_S1, files: ['data/sem1/Natalitate_Ro.csv'] },
  { id: 'acp', label: 'ACP', text: T_ACP, files: ['data/acp/ConsumAlimentar.csv'] },
];

export const SOLUTIONS = [
  {
    id: 'i2014', preset: 'i2014', title: 'Testul cu firmele (I2014)', sub: 'Raport pe localitate, rată pe județ, maxim pe județ, medie ponderată',
    dir: 'rezolvari/test_i2014/', files: ['main.py'], data: false,
    explain: [
      ['1', 'Păstrez doar localitățile cu <code>NrSal &gt; 0</code> (altfel împărțirea la 0 dă <code>inf</code>). Iau coloana <code>DenLocalitate</code>, adaug raportul, sortez descrescător și rotunjesc la 3 zecimale, ca în exemplu. <code>Siruta</code> apare singur în fișier, pentru că e indexul.'],
      ['2', 'Unesc firmele cu populația pe Siruta (index cu index). Adun <code>NrSal</code> și <code>Populatie</code> pe județ, apoi rata = NrSal × 1000 / Populatie. Seria primește numele <code>Rata Ocuparii</code>, ca să apară în antet.'],
      ['3', 'Calculez profitul pe locuitor pentru fiecare localitate. Pe fiecare județ, <code>idxmax()</code> dă indexul rândului cu valoarea maximă, iar <code>x.loc[..., "DenLocalitate"]</code> scoate denumirea lui.'],
      ['4', '<code>calcul_medie</code> primește tabelul unui județ: ultima coloană e ponderea (<code>Populatie</code>), restul sunt indicatorii. <code>np.average(..., weights=...)</code> face media ponderată. <code>include_groups=False</code> scoate coloana <code>Judet</code> din tabelul primit de funcție.'],
    ],
    note: 'Nu am fișierele testului, așa că rezolvarea e verificată pe date de probă cu aceeași structură. Dacă <code>PopulatieLocalitati.csv</code> are și el o coloană <code>DenLocalitate</code>, după merge apar <code>DenLocalitate_x</code> / <code>DenLocalitate_y</code>: atunci folosește <code>df_populatie[["Judet", "Populatie"]]</code> în merge.',
  },
  {
    id: 'tema24', preset: 'tema24', title: 'Tema 2.4: Industria alimentară', sub: 'Filtrare, procente, ponderi, activitatea dominantă, medie ponderată, indici de localizare',
    dir: 'rezolvari/tema2_4/', files: ['main.py'], data: true,
    explain: [
      ['1', 'Totalul pe fiecare rând cu <code>apply(..., axis=1)</code>, apoi păstrez rândurile cu total mai mare decât 0. Rămân toate coloanele, cum cere enunțul.'],
      ['2', 'Procentele pe rând: <code>x * 100 / x.sum()</code>. Unde totalul e 0 rezultă <code>NaN</code> (0/0), iar <code>fillna(0)</code> le face 0. <code>insert(0, ...)</code> pune coloana <code>Localitate</code> pe primul loc.'],
      ['3', 'Merge cu populația (doar <code>Judet</code> și <code>Populatie</code>, ca să nu apară <code>Localitate_x</code>), sumă pe județ, apoi totalul angajaților împărțit la populație.'],
      ['4', 'Pe tabelul cu sume pe județe, <code>x.index[x.argmax()]</code> dă numele coloanei cu cea mai mare valoare de pe rând.'],
      ['5', 'Regiunea vine din <code>Coduri_Judete.csv</code> (merge <code>Judet</code> ↔ index). Media ponderată pe regiune, cu <code>calcul_medie</code>.'],
      ['6', 'Indicele de localizare = (ponderea județului în activitate) / (ponderea județului în populație). <code>total</code> conține sumele pe țară.'],
    ],
    note: 'La cerința 5, exemplul din PDF (2516.507…) iese doar dacă faci întâi totalurile pe județe și apoi media ponderată a județelor (varianta b din cod). Codul de la seminar face media direct pe localități și dă 2256.56…. Am pus ambele variante.',
  },
  {
    id: 'tema21', preset: 'tema21', title: 'Tema 2.1: Etnii', sub: 'Sume pe județ/regiune/macroregiune, procente, disimilaritate, Shannon',
    dir: 'rezolvari/tema2_1/', files: ['main.py', 'functii.py'], data: true,
    explain: [
      ['1', 'Merge pe cod cu <code>Coduri_Localitati</code> aduce județul (<code>County</code>). Suma pe județ, apoi județele se unesc cu <code>Coduri_Judete</code> (index ↔ <code>IndicativJudet</code>) pentru regiune, iar regiunile cu <code>Coduri_Regiuni</code> pentru macroregiune.'],
      ['2', 'Structura etnică pe fiecare rând (<code>x * 100 / x.sum()</code>), la fiecare nivel.'],
      ['3', '<code>disimilaritate</code> și <code>shannon</code> primesc tabelul unui județ și întorc câte o valoare pentru fiecare etnie. D compară distribuția etniei cu a restului populației; H arată cât de împrăștiată e etnia între localități.'],
    ],
    note: 'În PDF fișierul apare ca „Etnicity.csv”, dar în seminar se numește „Ethnicity.csv”. Site-ul le potrivește automat.',
  },
  {
    id: 'sem1', preset: 'sem1', title: 'Seminarul 1: Natalitate', sub: 'Pivot, valori lipsă, covarianță, corelație, standardizare',
    dir: 'rezolvari/seminar1/', files: ['main.py', 'functii.py'], data: true,
    explain: [
      ['1', '<code>pivot_table</code> pune județele pe linii și anii pe coloane. <code>nan_replace</code> înlocuiește fiecare valoare lipsă cu media anului ei.'],
      ['2–3', '<code>np.cov</code> și <code>np.corrcoef</code> cu <code>rowvar=False</code>, pentru că variabilele (anii) sunt pe coloane.'],
      ['4', 'Standardizare: (x − media) / abaterea standard, pe fiecare coloană.'],
    ],
  },
  {
    id: 'acp', preset: 'acp', title: 'ACP: Consum alimentar (seminarele 4–5)', sub: 'Varianță, criterii de selecție, corelații factoriale, scoruri, cosinusuri, contribuții, comunalități',
    dir: 'rezolvari/acp/', files: ['main.py', 'functii.py', 'grafice.py'], data: true,
    explain: [
      ['', '<code>acp(x)</code> întoarce: <code>x_</code> (datele standardizate), <code>r_v</code> (matricea de corelații), <code>alpha</code> (valorile proprii = varianța componentelor), <code>a</code> (vectorii proprii), <code>c</code> (componentele) și <code>r</code> (corelațiile factoriale).'],
      ['', 'Criterii pentru numărul de componente: Kaiser (<code>alpha &gt; 1</code>), varianța cumulată peste 80% și Cattell (cotul graficului).'],
      ['', 'Scoruri = <code>c / √alpha</code>. Cosinusuri = <code>c²</code> împărțit la suma pe rând. Contribuții = <code>c²</code> împărțit la suma pe coloană. Comunalități = suma cumulată a <code>r²</code>.'],
    ],
  },
];

export const CHEAT = [
  {
    title: 'Citire și salvare',
    items: [
      { t: 'Citire cu prima coloană ca index', code: 'df = pd.read_csv("data_in/Fisier.csv", index_col=0)', note: 'Codul Siruta / codul țării devine index și apare singur la salvare.' },
      { t: 'A doua coloană ca index', code: 'df = pd.read_csv("data_in/ConsumAlimentar.csv", index_col=1)' },
      { t: 'Salvare', code: 'df.to_csv("data_out/Cerinta1.csv")\ndf.to_csv("data_out/Cerinta1.csv", index=False)  # fără index\ndf.round(3).to_csv("data_out/Cerinta1.csv")      # 3 zecimale' },
      { t: 'Lista variabilelor (toate coloanele după nume)', code: 'variabile = list(df.columns.values)[1:]\nvariabile = list(df)[1:]  # la fel' },
      { t: 'Numele unei serii = antetul coloanei la salvare', code: 's.name = "Rata Ocuparii"\ns.index.name = "Judet"' },
    ],
  },
  {
    title: 'Selecție și filtrare',
    items: [
      { t: 'Coloane', code: 'df["NrSal"]                    # o coloană (Series)\ndf[["Localitate", "NrSal"]]    # mai multe (DataFrame)' },
      { t: 'Rânduri care respectă o condiție', code: 'df[df["NrSal"] > 0]\ndf[(df["A"] > 0) & (df["B"] < 10)]   # și\ndf[(df["A"] > 0) | (df["B"] > 0)]    # sau\ndf[df["X"] > df["X"].mean()]          # peste medie' },
      { t: 'Total pe rând > 0', code: 's_total = df[variabile].apply(func=lambda x: x.sum(), axis=1)\ndf_cerinta1 = df[s_total > 0]' },
      { t: 'Un rând după index / poziție', code: 'df.loc[1017]          # după index\ndf.iloc[0]            # primul rând\ndf.loc[1017, "NrSal"] # o celulă' },
      { t: 'Filtrare apoi coloană nouă (fără avertismente)', code: 'df_c = df[df["NrSal"] > 0]\ndf_cerinta = df_c[["DenLocalitate"]].copy()\ndf_cerinta["Raport"] = df_c["CA"] / df_c["NrSal"]' },
    ],
  },
  {
    title: 'Calcule pe rânduri',
    items: [
      { t: 'Procente pe rând (structură)', code: 'df_p = df[variabile].apply(func=lambda x: x * 100 / x.sum(), axis=1)\ndf_p = df_p.fillna(0)   # unde totalul e 0', note: 'axis=1 înseamnă „pentru fiecare rând”; axis=0 „pentru fiecare coloană”.' },
      { t: 'Fiecare variabilă împărțită la populație', code: 'df_c = df_loc[variabile + ["Populatie"]].apply(\n    func=lambda x: x[variabile] * 1000 / x["Populatie"],\n    axis=1)' },
      { t: 'Coloana cu valoarea maximă de pe rând', code: 's = df[variabile].apply(func=lambda x: x.index[x.argmax()], axis=1)', note: 'Pentru minim: argmin.' },
      { t: 'Pune o coloană pe primul loc', code: 'df_c.insert(0, "Localitate", df["Localitate"])' },
    ],
  },
  {
    title: 'Unirea fișierelor (merge)',
    items: [
      { t: 'Index cu index (ex. Siruta)', code: 'df_loc = df.merge(df_populatie, left_index=True, right_index=True)' },
      { t: 'Coloană cu index (ex. Judet ↔ IndicativJudet)', code: 'df_loc = df_loc.merge(df_coduri, left_on="Judet", right_index=True)' },
      { t: 'Index cu coloană', code: 'df_jud_ = df_jud.merge(df_coduri, left_index=True, right_on="IndicativJudet")' },
      { t: 'Doar unele coloane (evită _x / _y)', code: 'df.merge(df_populatie[["Judet", "Populatie"]], left_index=True, right_index=True)', note: 'Coloanele cu același nume în ambele tabele primesc sufixele _x și _y.' },
    ],
  },
  {
    title: 'Grupare (groupby)',
    items: [
      { t: 'Sumă / medie pe județ', code: 'df_jud = df_loc[variabile + ["Judet"]].groupby(by="Judet").sum()\ndf_jud = df_loc[variabile + ["Judet"]].groupby(by="Judet").mean()' },
      { t: 'Număr de localități pe județ', code: 's = df_loc.groupby(by="Judet").size()' },
      { t: 'Funcție proprie pe fiecare grup', code: 'df_c = df_loc[variabile + ["Populatie", "Judet"]].groupby(by="Judet").apply(\n    func=calcul_medie,\n    include_groups=False)', note: 'include_groups=False scoate coloana de grupare din tabelul primit de funcție (pandas ≥ 2.2).' },
      { t: 'Rată la 1000 de locuitori pe județ', code: 'df_jud = df_loc[["NrSal", "Populatie", "Judet"]].groupby(by="Judet").sum()\ns = df_jud["NrSal"] * 1000 / df_jud["Populatie"]\ns.name = "Rata"\ns.sort_values(ascending=False).to_csv("data_out/Cerinta2.csv")' },
    ],
  },
  {
    title: 'Maxim, minim, top',
    items: [
      { t: 'Pentru fiecare județ, localitatea cu maximul', code: 's = df_loc[["Localitate", "X", "Judet"]].groupby(by="Judet").apply(\n    func=lambda x: x.loc[x["X"].idxmax(), "Localitate"],\n    include_groups=False)' },
      { t: 'Index / poziția maximului', code: 'df["X"].idxmax()   # indexul rândului\ndf["X"].argmax()   # poziția (0, 1, 2…)' },
      { t: 'Primele N', code: 'df.nlargest(3, "X")\ndf.sort_values(by="X", ascending=False).head(3)' },
      { t: 'Sortare', code: 's.sort_values(ascending=False)                # Series\ndf.sort_values(by="Raport", ascending=False)  # DataFrame' },
    ],
  },
  {
    title: 'Medie ponderată',
    items: [
      { t: 'Funcția din seminar', code: 'def calcul_medie(df: pd.DataFrame):\n    x = df.values\n    medii = np.average(x[:, :-1], axis=0, weights=x[:, -1])\n    return pd.Series(medii, df.columns[:-1])', note: 'Ponderea (Populatie) trebuie să fie ultima coloană, înaintea coloanei de grupare.' },
      { t: 'Folosire', code: 'df_c = df_loc[variabile + ["Populatie", "Regiune"]].groupby(by="Regiune").apply(\n    func=calcul_medie, include_groups=False)' },
    ],
  },
  {
    title: 'Valori lipsă',
    items: [
      { t: 'Unde sunt', code: 'df.isna().any()       # pe coloane\ndf.isna().sum().sum() # câte în total' },
      { t: 'nan_replace_df (seminarele 2, 4)', code: 'def nan_replace_df(df: pd.DataFrame):\n    for c in df.columns:\n        if df[c].isna().any():\n            if is_numeric_dtype(df[c]):\n                df.fillna({c: df[c].mean()}, inplace=True)\n            else:\n                df.fillna({c: df[c].mode()[0]}, inplace=True)', note: 'from pandas.api.types import is_numeric_dtype' },
      { t: 'nan_replace pe numpy (seminarul 1)', code: 'def nan_replace(x: np.ndarray):\n    y = x.copy()\n    k = np.where(np.isnan(y))\n    y[k] = np.nanmean(y[:, k[1]], axis=0)\n    return y' },
    ],
  },
  {
    title: 'Pivot, covarianță, corelație, standardizare',
    items: [
      { t: 'Pivot', code: 'df = t.pivot_table(index="Judete", columns="Ani", values="Valoare")' },
      { t: 'Matrici', code: 'x = df[variabile].values\nv = np.cov(x, rowvar=False)\nr = np.corrcoef(x, rowvar=False)\ndf_r = pd.DataFrame(r, variabile, variabile)' },
      { t: 'Standardizare', code: 'x_std = (x - np.mean(x, axis=0)) / np.std(x, axis=0)\ndf_std = pd.DataFrame(x_std, df.index, variabile)' },
    ],
  },
  {
    title: 'Indici',
    items: [
      { t: 'Indice de localizare', code: 'df_jud = df_loc[variabile + ["Populatie", "Judet"]].groupby(by="Judet").sum()\ntotal = df_jud.sum()\ndf_lq = df_jud.apply(\n    func=lambda x: (x[variabile] / total[variabile]) / (x["Populatie"] / total["Populatie"]),\n    axis=1)' },
      { t: 'Coeficient de variație', code: 'g = df_loc[variabile + ["Continent"]].groupby(by="Continent")\ndf_cv = g.std() / g.mean()' },
      { t: 'Disimilaritate', code: 'def disimilaritate(df: pd.DataFrame):\n    x = df.values\n    tx = np.sum(x, axis=0)\n    tx[tx == 0] = 1\n    sx = np.sum(x, axis=1)\n    r = (sx - x.T).T\n    tr = np.sum(r, axis=0)\n    tr[tr == 0] = 1\n    d = 0.5 * np.sum(np.abs(x / tx - r / tr), axis=0)\n    return pd.Series(d, df.columns)' },
      { t: 'Shannon-Weaver', code: 'def shannon(df: pd.DataFrame):\n    x = df.values\n    tx = np.sum(x, axis=0)\n    tx[tx == 0] = 1\n    p = x / tx\n    p[p == 0] = 1\n    h = -np.sum(p * np.log2(p), axis=0)\n    return pd.Series(h, df.columns)' },
    ],
  },
  {
    title: 'Erori frecvente',
    items: [
      { t: 'KeyError: \'Judet\'', code: 'print(list(df))   # vezi numele exacte ale coloanelor', note: 'Coloana nu există cu numele ăsta (litere mari/mici, spații) sau a primit sufixul _x / _y după merge.' },
      { t: 'Cannot save file into a non-existent directory', code: 'import os\nos.makedirs("data_out", exist_ok=True)' },
      { t: 'unexpected keyword argument \'include_groups\'', code: 'df_loc[variabile + ["Populatie", "Judet"]].groupby(by="Judet")[variabile + ["Populatie"]].apply(func=calcul_medie)', note: 'pandas mai vechi de 2.2: selectezi coloanele după groupby, în loc de include_groups=False.' },
      { t: 'Merge-ul iese gol', code: 'df["Judet"] = df["Judet"].str.lower()   # "AB" vs "ab"', note: 'Codurile din cele două fișiere nu se potrivesc exact.' },
      { t: 'Valori inf în rezultat', code: 'df_c = df[df["NrSal"] > 0]', note: 'Împărțire la 0: filtrează numitorul înainte.' },
    ],
  },
  {
    title: 'ACP pe scurt',
    items: [
      { t: 'Pașii', code: 'x = df[variabile].values\nx_, r_v, alpha, a, c, r = acp(x)\ndf_varianta = tabelare_varianta(alpha)\ns = c / np.sqrt(alpha)                       # scoruri\nc2 = c * c\ncosin = (c2.T / np.sum(c2, axis=1)).T         # cosinusuri\ncontrib = c2 * 100 / np.sum(c2, axis=0)       # contribuții\ncomm = np.cumsum(r * r, axis=1)               # comunalități', note: 'Criterii: Kaiser (alpha > 1), varianța cumulată > 80%, Cattell (cotul graficului).' },
    ],
  },
];
