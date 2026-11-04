import numpy as np
import pandas as pd
from pandas.api.types import is_numeric_dtype


def nan_replace_df(df: pd.DataFrame):
    for c in df.columns:
        if df[c].isna().any():
            if is_numeric_dtype(df[c]):
                df.fillna({c: df[c].mean()}, inplace=True)
            else:
                df.fillna({c: df[c].mode()[0]}, inplace=True)


def acp(x: np.ndarray, std=True, nlib=0):
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
    return x_, r_v, alpha, a, c, r


def tabelare_varianta(alpha: np.ndarray):
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
    return df_varianta


def tabelare_salvare_matrice(
        x: np.ndarray,
        index_linie,
        index_coloana,
        nume_index,
        nume_fisier=None
):
    df = pd.DataFrame(x,
                      index=index_linie,
                      columns=index_coloana)
    df.index.name = nume_index
    if nume_fisier is not None:
        df.to_csv("data_out/" + nume_fisier)
    return df
