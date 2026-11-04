import numpy as np
import pandas as pd

pd.set_option('display.max_columns', None)


def calcul_medie(df: pd.DataFrame):
    # ultima coloana = ponderea (Populatie), restul = valorile
    x = df.values
    medii = np.average(x[:, :-1], axis=0, weights=x[:, -1])
    return pd.Series(medii, df.columns[:-1])


df_firme = pd.read_csv("data_in/I2014.csv", index_col=0)
indicatori = list(df_firme.columns.values)[1:]
df_populatie = pd.read_csv("data_in/PopulatieLocalitati.csv", index_col=0)

# 1
df_salariati = df_firme[df_firme["NrSal"] > 0]
df_cerinta1 = df_salariati[["DenLocalitate"]].copy()
df_cerinta1["Raport CA/NrSal"] = df_salariati["TotalCifraAfaceri"] / df_salariati["NrSal"]
df_cerinta1.sort_values(by="Raport CA/NrSal", ascending=False).round(3).to_csv("data_out/Output1.csv")

# 2
df_firme_loc = df_firme.merge(df_populatie, left_index=True, right_index=True)
df_firme_jud = df_firme_loc[["NrSal", "Populatie", "Judet"]].groupby(by="Judet").sum()
s_cerinta2 = df_firme_jud["NrSal"] * 1000 / df_firme_jud["Populatie"]
s_cerinta2.name = "Rata Ocuparii"
s_cerinta2.sort_values(ascending=False).to_csv("data_out/Output2.csv")

# 3
df_c3 = df_firme_loc[["DenLocalitate", "TotalProfit", "Populatie", "Judet"]].copy()
df_c3["ProfitLocuitor"] = df_c3["TotalProfit"] / df_c3["Populatie"]
s_cerinta3 = df_c3[["DenLocalitate", "ProfitLocuitor", "Judet"]].groupby(by="Judet").apply(
    func=lambda x: x.loc[x["ProfitLocuitor"].idxmax(), "DenLocalitate"],
    include_groups=False)
s_cerinta3.name = "Localitate"
s_cerinta3.to_csv("data_out/Output3.csv")

# 4
df_cerinta4 = df_firme_loc[indicatori + ["Populatie", "Judet"]].groupby(by="Judet").apply(
    func=calcul_medie,
    include_groups=False)
df_cerinta4.round(3).to_csv("data_out/Output4.csv")
