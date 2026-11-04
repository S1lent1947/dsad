import numpy as np
import pandas as pd

pd.set_option('display.max_columns', None)


def calcul_medie(df: pd.DataFrame):
    # ultima coloana = ponderea (Populatie), restul = valorile
    x = df.values
    medii = np.average(x[:, :-1], axis=0, weights=x[:, -1])
    return pd.Series(medii, df.columns[:-1])


df_industria_a = pd.read_csv("data_in/IndustriaAlimentara.csv", index_col=0)
activitati = list(df_industria_a.columns.values)[1:]
df_populatie = pd.read_csv("data_in/PopulatieLocalitati.csv", index_col=0)
df_coduri = pd.read_csv("data_in/Coduri_Judete.csv", index_col=0)

# 1
s_total_loc = df_industria_a[activitati].apply(
    func=lambda x: x.sum(),
    axis=1)
df_cerinta1 = df_industria_a[s_total_loc > 0]
df_cerinta1.to_csv("data_out/Cerinta1.csv")

# 2
df_cerinta2 = df_industria_a[activitati].apply(
    func=lambda x: x * 100 / x.sum(),
    axis=1)
df_cerinta2 = df_cerinta2.fillna(0)  # unde totalul e 0 -> procente 0
df_cerinta2.insert(0, "Localitate", df_industria_a["Localitate"])
df_cerinta2.to_csv("data_out/Cerinta2.csv")

# 3
df_industria_a_loc = df_industria_a.merge(
    df_populatie[["Judet", "Populatie"]], left_index=True, right_index=True)
df_industria_a_jud = df_industria_a_loc[activitati + ["Populatie", "Judet"]].groupby(by="Judet").sum()
s_cerinta3 = df_industria_a_jud[activitati].sum(axis=1) / df_industria_a_jud["Populatie"]
s_cerinta3.name = "Ponderi"
s_cerinta3.sort_values(ascending=False).to_csv("data_out/Cerinta3.csv")

# 4
s_cerinta4 = df_industria_a_jud[activitati].apply(
    func=lambda x: x.index[x.argmax()],
    axis=1)
s_cerinta4.name = "Activitate"
s_cerinta4.to_csv("data_out/Cerinta4.csv")

# 5 (varianta din seminar: media ponderata a localitatilor din regiune)
df_industria_a_reg = df_industria_a_loc.merge(df_coduri, left_on="Judet", right_index=True)
df_cerinta5 = df_industria_a_reg[activitati + ["Populatie", "Regiune"]].groupby(by="Regiune").apply(
    func=calcul_medie,
    include_groups=False)
df_cerinta5.to_csv("data_out/Cerinta5.csv")

# 5 (varianta care da exact exemplul din PDF: intai totaluri pe judete, apoi media ponderata pe regiune)
df_jud_reg = df_industria_a_reg[activitati + ["Populatie", "Regiune", "Judet"]].groupby(by=["Regiune", "Judet"]).sum()
df_cerinta5_b = df_jud_reg.groupby(level=0).apply(func=calcul_medie)
df_cerinta5_b.to_csv("data_out/Cerinta5_b.csv")

# 6
total = df_industria_a_jud.sum()
df_cerinta6 = df_industria_a_jud.apply(
    func=lambda x: (x[activitati] / total[activitati]) / (x["Populatie"] / total["Populatie"]),
    axis=1)
df_cerinta6.to_csv("data_out/Cerinta6.csv")
