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


def disimilaritate(df: pd.DataFrame):
    # D = 1/2 * suma |x_i/Tx - r_i/Tr|  (pentru fiecare etnie)
    x = df.values
    tx = np.sum(x, axis=0)
    tx[tx == 0] = 1
    sx = np.sum(x, axis=1)
    r = (sx - x.T).T
    tr = np.sum(r, axis=0)
    tr[tr == 0] = 1
    d = 0.5 * np.sum(np.abs(x / tx - r / tr), axis=0)
    return pd.Series(d, df.columns)


def shannon(df: pd.DataFrame):
    # H = -suma p_i * log2(p_i), p_i = ponderea localitatii i in totalul etniei
    x = df.values
    tx = np.sum(x, axis=0)
    tx[tx == 0] = 1
    p = x / tx
    p[p == 0] = 1  # log2(1) = 0, deci termenii cu p = 0 nu conteaza
    h = -np.sum(p * np.log2(p), axis=0)
    return pd.Series(h, df.columns)
