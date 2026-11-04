import numpy as np
import pandas as pd

pd.set_option('display.max_columns', None)

df_agricultura = pd.read_csv("data_in/Agricultura.csv", index_col=0)
activitati = list(df_agricultura.columns.values)[1:]
df_populatie = pd.read_csv("data_in/PopulatieLocalitati.csv", index_col=0)
df_coduri = pd.read_csv("data_in/Coduri_Judete.csv", index_col=0)

df_agricultura_loc = df_agricultura.merge(
    df_populatie[["Judet", "Populatie"]], left_index=True, right_index=True)
df_agricultura_loc = df_agricultura_loc.merge(df_coduri, left_on="Judet", right_index=True)

# 1
df_cerinta1 = df_agricultura_loc[activitati + ["Populatie"]].apply(
    func=lambda x: x[activitati] / x["Populatie"],
    axis=1)
df_cerinta1.insert(0, "Localitate", df_agricultura_loc["Localitate"])
df_cerinta1.round(3).to_csv("data_out/Cerinta1.csv")

# 2
df_jud = df_agricultura_loc[activitati + ["Judet"]].groupby(by="Judet").sum()
s_cerinta2 = df_jud[activitati].apply(
    func=lambda x: x.index[x.argmax()],
    axis=1)
s_cerinta2.name = "Activitate"
s_cerinta2.to_csv("data_out/Cerinta2.csv")

# 3
s_total = df_agricultura[activitati].sum(axis=1)
df_cerinta3 = df_agricultura[s_total > s_total.mean()][["Localitate"]].copy()
df_cerinta3["CifraAfaceri"] = s_total
df_cerinta3.sort_values(by="CifraAfaceri", ascending=False).to_csv("data_out/Cerinta3.csv")

# 4
df_jud_reg = df_agricultura_loc[activitati + ["Populatie", "Regiune", "Judet"]].groupby(by=["Regiune", "Judet"]).sum()
df_jud_reg["CA_locuitor"] = df_jud_reg[activitati].sum(axis=1) / df_jud_reg["Populatie"]
s_cerinta4 = df_jud_reg.groupby(level=0).apply(
    func=lambda x: x["CA_locuitor"].idxmax()[1])
s_cerinta4.name = "Judet"
s_cerinta4.to_csv("data_out/Cerinta4.csv")
