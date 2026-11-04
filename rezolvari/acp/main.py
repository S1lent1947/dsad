import sys

import numpy as np
import pandas as pd

from functii import nan_replace_df, acp, tabelare_varianta, tabelare_salvare_matrice
from grafice import plot_varianta, show, corelograma, plot_scoruri_corelatii

np.set_printoptions(suppress=True, precision=3, threshold=sys.maxsize)

df = pd.read_csv("data_in/ConsumAlimentar.csv", index_col=1)
variabile_observate = list(df.columns.values)[1:]

nan_replace_df(df)
x = df[variabile_observate].values
x_, r_v, alpha, a, c, r = acp(x)

# 1. Varianta componentelor + criterii de selectie
df_varianta = tabelare_varianta(alpha)
df_varianta.round(3).to_csv("data_out/Varianta.csv")
k = plot_varianta(alpha)
nr_componente_semnificative = min(v for v in k if v is not None)
print("Numar componente semnificative:", nr_componente_semnificative)
etichete_c = list(df_varianta.index)

# 2. Corelatii factoriale (variabile observate x componente)
df_r = tabelare_salvare_matrice(r, variabile_observate, etichete_c, "Variabile", "r.csv")
corelograma(df_r)
for i in range(2, nr_componente_semnificative + 1):
    plot_scoruri_corelatii(df_r, col_x="C1", col_y="C" + str(i),
                           titlu="Corelatii factoriale", scoruri=False)

# 3. Scoruri (componente standardizate)
s = c / np.sqrt(alpha)
df_s = tabelare_salvare_matrice(s, df.index, etichete_c, df.index.name, "s.csv")
plot_scoruri_corelatii(df_s, col_x="C1", col_y="C2", titlu="Plot scoruri")

# 4. Cosinusuri (calitatea reprezentarii observatiilor)
c2 = c * c
cosin = (c2.T / np.sum(c2, axis=1)).T
tabelare_salvare_matrice(cosin, df.index, etichete_c, df.index.name, "cosin.csv")

# 5. Contributii ale observatiilor la varianta componentelor (%)
contrib = c2 * 100 / np.sum(c2, axis=0)
tabelare_salvare_matrice(contrib, df.index, etichete_c, df.index.name, "contrib.csv")

# 6. Comunalitati
comm = np.cumsum(r * r, axis=1)
df_comm = tabelare_salvare_matrice(comm, variabile_observate, etichete_c, "Variabile", "comm.csv")
corelograma(df_comm, titlu="Comunalitati", vmin=0, cmap="Blues")

show()
