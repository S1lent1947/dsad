import numpy as np


def nan_replace(x: np.ndarray):
    # inlocuieste fiecare NaN cu media coloanei lui
    y = x.copy()
    k = np.where(np.isnan(y))
    y[k] = np.nanmean(y[:, k[1]], axis=0)
    return y


def standardize(x: np.ndarray, scal=True, ddof=0):
    x_ = x - np.mean(x, axis=0)
    if scal:
        x_ = x_ / np.std(x_, axis=0, ddof=ddof)
    return x_
