import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from seaborn import heatmap


def plot_varianta(alpha: np.ndarray, std=True, P=80):
    fig = plt.figure(figsize=(10, 6))
    ax = fig.add_subplot(1, 1, 1)
    m = len(alpha)
    x = np.arange(1, m + 1)
    ax.plot(x, alpha)
    ax.set_xticks(x)
    ax.set_title("Plot varianta", fontdict={"fontsize": 16})
    ax.set_xlabel("Componenta", fontdict={"fontsize": 12, "color": "b"})
    ax.set_ylabel("Varianta", fontdict={"fontsize": 12, "color": "b"})
    ax.scatter(x, alpha, c="r", alpha=0.5)
    # Criteriul Kaiser
    if std:
        k1 = len(np.where(alpha > 1)[0])
        ax.axhline(1, color="m", label="Kaiser")
    else:
        k1 = None
    # Criteriul variantei minimale
    varianta_totala = sum(alpha)
    procent_varianta_cumulata = np.cumsum(alpha * 100 / varianta_totala)
    k2 = np.where(procent_varianta_cumulata > P)[0][0] + 1
    ax.axhline(alpha[k2 - 1], color="g", label="Varianta cumulata (>" + str(P) + "%)")
    # Criteriul Cattell (Elbow)
    eps = alpha[:m - 1] - alpha[1:]
    d = eps[:m - 2] - eps[1:]
    if np.any(d < 0):
        k3 = np.where(d < 0)[0][0] + 2
        ax.axhline(alpha[k3 - 1], color="c", label="Criteriul Cattell (Elbow)")
    else:
        k3 = None
    ax.legend()
    return k1, k2, k3


def corelograma(
        df: pd.DataFrame,
        titlu="Corelatii factoriale",
        vmin=-1,
        annot=True,
        cmap="RdYlBu"
):
    fig = plt.figure(figsize=(10, 6))
    ax = fig.add_subplot(1, 1, 1)
    ax.set_title(titlu, fontdict={"fontsize": 16})
    heatmap(df, vmin=vmin, vmax=1, cmap=cmap, annot=annot, ax=ax)
    ax.set_yticklabels(
        ax.get_yticklabels(),
        rotation=45,
        ha="right",
        va="center_baseline")


def plot_scoruri_corelatii(
        df: pd.DataFrame,
        col_x="C1", col_y="C2",
        titlu="Plot scoruri",
        scoruri=True,
        etichetare=True
):
    fig = plt.figure(figsize=(7, 7))
    ax = fig.add_subplot(1, 1, 1, aspect=1)
    ax.set_title(titlu, fontdict={"fontsize": 16})
    ax.set_xlabel(col_x, fontdict={"fontsize": 12, "color": "b"})
    ax.set_ylabel(col_y, fontdict={"fontsize": 12, "color": "b"})
    ax.scatter(df[col_x], df[col_y], c="r", alpha=0.5)
    if not scoruri:
        step = 0.05
        x = np.arange(0, np.pi * 2 + step, step)
        ax.plot(np.cos(x), np.sin(x))
        ax.plot(0.7 * np.cos(x), 0.7 * np.sin(x), color="g")
        ax.axvline(0, color="k", linestyle="--")
        ax.axhline(0, color="k", linestyle="--")
    if etichetare:
        n = len(df)
        for i in range(n):
            ax.text(df[col_x].values[i], df[col_y].values[i], df.index[i])


def show():
    plt.show()
