import sys

import numpy as np
import pandas as pd

from functii import nan_replace, standardize

np.set_printoptions(suppress=True, precision=3, threshold=sys.maxsize)

t = pd.read_csv("data_in/Natalitate_Ro.csv")

# 1. Tabel pivot: judetele pe linii, anii pe coloane
df = t.pivot_table(index="Judete", columns="Ani", values="Valoare")
variabile = list(df)

# Inlocuire valori lipsa (cu media coloanei)
x = df[variabile].values
x = nan_replace(x)

# 2. Matricea de covarianta
v = np.cov(x, rowvar=False)
df_cov = pd.DataFrame(v, variabile, variabile)
df_cov.to_csv("data_out/V.csv")

# 3. Matricea de corelatie
r = np.corrcoef(x, rowvar=False)
df_r = pd.DataFrame(r, variabile, variabile)
df_r.to_csv("data_out/R.csv")

# 4. Standardizare
x_std = standardize(x)
df_x_std = pd.DataFrame(x_std, df.index, variabile)
df_x_std.to_csv("data_out/x_std.csv")
