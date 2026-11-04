import pandas as pd

from functii import nan_replace_df, disimilaritate, shannon

pd.set_option('display.max_columns', None)

df = pd.read_csv("data_in/Ethnicity.csv", index_col=0)
nan_replace_df(df)
etnii = list(df)[1:]

df_coduri_loc = pd.read_csv("data_in/Coduri_Localitati.csv", index_col=0)
df_coduri_jud = pd.read_csv("data_in/Coduri_Judete.csv", index_col=0)
df_coduri_reg = pd.read_csv("data_in/Coduri_Regiuni.csv", index_col=0)

# 1. Populatia pe etnii la nivel de judet, regiune si macroregiune
df_etnii_loc = df.merge(df_coduri_loc, left_index=True, right_index=True)
df_etnii_jud = df_etnii_loc[etnii + ["County"]].groupby(by="County").sum()
df_etnii_jud.to_csv("data_out/Etnii_jud.csv")

df_etnii_jud_ = df_etnii_jud.merge(df_coduri_jud, left_index=True, right_on="IndicativJudet")
df_etnii_reg = df_etnii_jud_[etnii + ["Regiune"]].groupby(by="Regiune").sum()
df_etnii_reg.to_csv("data_out/Etnii_reg.csv")

df_etnii_reg_ = df_etnii_reg.merge(df_coduri_reg, left_index=True, right_index=True)
df_etnii_macroreg = df_etnii_reg_[etnii + ["MacroRegiune"]].groupby(by="MacroRegiune").sum()
df_etnii_macroreg.to_csv("data_out/Etnii_macroreg.csv")

# 2. Procente pe etnii la nivel de localitate, judet, regiune si macroregiune
df_etnii_p = df[etnii].apply(func=lambda x: x * 100 / x.sum(), axis=1)
df_etnii_p.insert(0, "City", df["City"])
df_etnii_p.to_csv("data_out/Etnii_p.csv")

df_etnii_jud_p = df_etnii_jud[etnii].apply(func=lambda x: x * 100 / x.sum(), axis=1)
df_etnii_jud_p.to_csv("data_out/Etnii_jud_p.csv")

df_etnii_reg_p = df_etnii_reg[etnii].apply(func=lambda x: x * 100 / x.sum(), axis=1)
df_etnii_reg_p.to_csv("data_out/Etnii_reg_p.csv")

df_etnii_macroreg_p = df_etnii_macroreg[etnii].apply(func=lambda x: x * 100 / x.sum(), axis=1)
df_etnii_macroreg_p.to_csv("data_out/Etnii_macroreg_p.csv")

# 3. Indici de segregare la nivel de judet
df_disimilaritate = df_etnii_loc[etnii + ["County"]].groupby(by="County").apply(
    func=disimilaritate,
    include_groups=False)
df_disimilaritate.to_csv("data_out/Disimilaritate.csv")

df_shannon = df_etnii_loc[etnii + ["County"]].groupby(by="County").apply(
    func=shannon,
    include_groups=False)
df_shannon.to_csv("data_out/Shannon.csv")
