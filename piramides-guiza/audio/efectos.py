#!/usr/bin/env python3
"""Efectos de sonido sintetizados y sincronizados con la animación (mismos tiempos que la escena 3D):
viento, cinceles de cobre y mazos, palancas, piedra que roza, remos, agua, arrastre en arena seca y
húmeda, pasos, murmullo de cuadrillas, hologramas de hipótesis, grillos y ciudad al final."""
import os
import numpy as np
import soundfile as sf
from sintesis import SR, lp, hp, bp, ruido_rosa, ir_sala, reverb, colocar, pan, t_arr, whoosh, env_adsr

RNG = np.random.default_rng(4500)
DUR = 70.0
N = int(DUR * SR)
AQUI = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(AQUI, 'build')
os.makedirs(OUT, exist_ok=True)

amb = np.zeros((2, N))   # ambientes continuos
ev = np.zeros((2, N))    # eventos puntuales


def ventana(n, ini, fin, fade=0.6):
    """Envolvente de 0..1 entre ini y fin (s) con fundidos."""
    t = np.arange(n) / SR
    return np.clip(np.minimum((t - ini) / fade, (fin - t) / fade), 0, 1)


# ---------- generadores ----------
def viento(dur, seed=0):
    n = int(dur * SR)
    r = np.random.default_rng(seed)
    base = ruido_rosa(n)
    t = np.arange(n) / SR
    rafaga = 0.55 + 0.45 * np.sin(2 * np.pi * 0.07 * t + 1) * np.sin(2 * np.pi * 0.13 * t + 2)
    out = np.zeros(n)
    seg = int(0.25 * SR)
    for i in range(0, n, seg):
        fc = 350 + 500 * (0.5 + 0.5 * np.sin(i / SR * 0.4 + seed))
        out[i:i + seg] = bp(base, fc * 0.5, fc * 2.2)[i:i + seg]
    return lp(out, 2500) * rafaga * 0.5


def golpe_cincel(fuerza=1.0, seed=0):
    r = np.random.default_rng(seed)
    t = t_arr(0.6)
    nudo = bp(r.standard_normal(len(t)), 250, 900) * np.exp(-t * 45) * 1.2                 # mazo de madera
    anillo = sum(np.sin(2 * np.pi * f * t + r.uniform(0, 6)) * a * np.exp(-t * d)
                 for f, a, d in [(1730, 0.35, 38), (2960, 0.25, 48), (4470, 0.18, 60), (6120, 0.08, 75)])  # cobre
    piedra = hp(r.standard_normal(len(t)), 2200) * np.exp(-t * 70) * 0.7                   # roca
    esquirlas = np.zeros(len(t))
    for _ in range(9):
        i = int(r.uniform(0.02, 0.35) * SR)
        k = int(0.006 * SR)
        esquirlas[i:i + k] += hp(r.standard_normal(k), 3000) * r.uniform(0.1, 0.35) * np.exp(-np.arange(k) / k * 4)
    return (nudo + anillo + piedra + esquirlas) * fuerza


def crujido(dur, f_res=700, tasa=(40, 140), seed=0):
    """Fricción madera/cuerda: tren de micro-impulsos (stick-slip) con resonancia."""
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    imp = np.zeros(n)
    i = 0
    while i < n:
        frac = i / n
        rate = tasa[0] + (tasa[1] - tasa[0]) * np.sin(np.pi * frac) ** 0.7
        imp[i] = r.uniform(0.5, 1.0)
        i += max(1, int(SR / rate * r.uniform(0.7, 1.3)))
    out = bp(imp, f_res * 0.7, f_res * 1.4, 2) + bp(imp, f_res * 2.1, f_res * 2.6, 2) * 0.4
    return out * np.sin(np.pi * np.linspace(0, 1, n)) ** 0.5 * 3


def roce_piedra(dur, aspero=1.0, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    base = bp(r.standard_normal(n), 70, 700)
    grano = lp(np.abs(r.standard_normal(n)), 40) * 3
    crk = hp(r.standard_normal(n), 1500) * (r.random(n) < 0.002) * 2 * aspero
    return (base * grano + lp(crk, 6000)) * np.sin(np.pi * np.linspace(0, 1, n)) ** 0.4


def arrastre_arena(dur, seco=True, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    if seco:
        x = bp(r.standard_normal(n), 300, 3200) * (0.6 + 0.4 * lp(np.abs(r.standard_normal(n)), 25) * 2.5)
        x += lp(hp(r.standard_normal(n), 2000), 5000) * (r.random(n) < 0.003) * 0.8
        x += bp(r.standard_normal(n), 60, 250) * 0.8
        pulso = 0.6 + 0.4 * np.abs(np.sin(np.pi * t * 1.6))
    else:
        x = bp(r.standard_normal(n), 150, 1800) * 0.7 + bp(r.standard_normal(n), 60, 200) * 0.4
        pulso = 0.8 + 0.2 * np.abs(np.sin(np.pi * t * 1.4))
    return x * pulso


def pasos(dur, cadencia=2.6, seed=0, gente=12):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    out = np.zeros(n)
    k = int(0.05 * SR)
    for g in range(gente):
        tt = r.uniform(0, 1 / cadencia)
        while tt < dur:
            i = int(tt * SR)
            if i + k < n:
                out[i:i + k] += bp(r.standard_normal(k), 300, 3500) * np.exp(-np.arange(k) / k * 5) * r.uniform(0.15, 0.4)
            tt += 1 / cadencia * r.uniform(0.92, 1.08)
    return out


def chorro(dur, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    x = bp(r.standard_normal(n), 700, 5000) * (0.5 + 0.5 * lp(np.abs(r.standard_normal(n)), 60) * 3)
    burb = np.zeros(n)
    for _ in range(int(dur * 18)):
        i = int(r.uniform(0, dur - 0.05) * SR)
        k = int(r.uniform(0.01, 0.03) * SR)
        f0 = r.uniform(600, 1800)
        tt = np.arange(k) / SR
        burb[i:i + k] += np.sin(2 * np.pi * (f0 * tt + f0 * 3 * tt ** 2)) * np.exp(-tt * 120) * 0.3
    return x * 0.6 + burb


def salpicadura(seed=0, tam=1.0):
    r = np.random.default_rng(seed)
    t = t_arr(0.7)
    x = bp(r.standard_normal(len(t)), 400, 6000) * np.exp(-t * 9) * tam
    for _ in range(6):
        i = int(r.uniform(0.02, 0.4) * SR); k = int(0.02 * SR)
        f0 = r.uniform(500, 1500); tt = np.arange(k) / SR
        x[i:i + k] += np.sin(2 * np.pi * (f0 * tt + f0 * 4 * tt ** 2)) * np.exp(-tt * 100) * 0.25
    return x


def olas(dur, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    am = 0.5 + 0.5 * np.sin(2 * np.pi * 0.35 * t + r.uniform(0, 6)) * np.sin(2 * np.pi * 0.21 * t)
    return lp(bp(r.standard_normal(n), 150, 2500), 1800) * (0.3 + 0.7 * am ** 2)


def vela(dur, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    out = np.zeros(n)
    tt = 0.2
    while tt < dur:
        i = int(tt * SR); k = int(0.18 * SR)
        if i + k < n:
            out[i:i + k] += lp(r.standard_normal(k), 500) * np.exp(-np.arange(k) / k * 6) * r.uniform(0.3, 0.8)
        tt += r.uniform(0.6, 1.4)
    return out


def pajaros(dur, seed=0, cuantos=8):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    out = np.zeros(n)
    for _ in range(cuantos):
        t0 = r.uniform(0, dur - 0.5)
        for j in range(r.integers(2, 5)):
            k = int(r.uniform(0.05, 0.12) * SR)
            i = int((t0 + j * 0.13) * SR)
            if i + k >= n: break
            tt = np.arange(k) / SR
            f = r.uniform(2800, 4200) + 900 * np.sin(2 * np.pi * r.uniform(15, 30) * tt)
            out[i:i + k] += np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / tt[-1]) * 0.15
    return out


def murmullo(dur, seed=0, voces=14):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for v in range(voces):
        f1 = r.uniform(300, 700)
        x = bp(r.standard_normal(n), f1, f1 * 2.4)
        sil = 0.5 + 0.5 * np.sin(2 * np.pi * r.uniform(3, 6) * t + r.uniform(0, 6))
        frase = (np.sin(2 * np.pi * r.uniform(0.1, 0.3) * t + r.uniform(0, 6)) > -0.2).astype(float)
        out += x * sil * lp(frase, 8)
    return lp(out, 1500) / voces * 2


def destello(dur=1.4, seed=0):
    """Holograma: brillo cristalino (parciales agudos con batido) + soplo."""
    r = np.random.default_rng(seed)
    t = t_arr(dur)
    x = sum(np.sin(2 * np.pi * f * t) * np.sin(2 * np.pi * f * 1.003 * t + 1) for f in [2093, 3136, 4186, 5274])
    e = np.minimum(t / 0.25, 1) * np.exp(-t * 2.2)
    return x * e * 0.08 + whoosh(dur, 2000, 9000, 0.25) * 0.25


def pop(seed=0, f0=900):
    t = t_arr(0.18)
    f = f0 * (1 + 0.8 * np.exp(-t * 40))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 30) * 0.5 + hp(RNG.standard_normal(len(t)), 4000) * np.exp(-t * 200) * 0.2


def grillos(dur, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    out = np.zeros((2, n))
    for c in range(3):
        f = r.uniform(4200, 5200)
        p = r.uniform(-0.8, 0.8)
        tt = r.uniform(0, 0.5)
        while tt < dur:
            for j in range(3):
                i = int((tt + j * 0.035) * SR); k = int(0.022 * SR)
                if i + k < n:
                    s = np.sin(2 * np.pi * f * np.arange(k) / SR) * np.sin(np.pi * np.arange(k) / k) * 0.06
                    out += pan(np.pad(s, (i, n - i - k)), p)
            tt += r.uniform(0.45, 0.7)
    return out


def ciudad(dur, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    return lp(ruido_rosa(n), 220) * 0.6 + bp(r.standard_normal(n), 300, 1200) * 0.05


# ---------- ambientes por escena ----------
vt = viento(DUR, 1)
vt2 = viento(DUR, 7)
env_v = np.zeros(N)
for ini, fin, g in [(0, 5.3, 1.0), (5, 13.3, 0.7), (13, 22.3, 0.25), (22, 32.3, 0.35), (32, 43.3, 0.45), (43, 56.3, 0.9), (56, 66.6, 0.75), (66.3, 70, 0.45)]:
    env_v = np.maximum(env_v, ventana(N, ini, fin, 0.5) * g)
amb += np.stack([vt * env_v, vt2 * env_v]) * 0.5
# murmullo de cuadrillas (obra) y martilleo lejano
mm = murmullo(DUR, 3)
env_m = np.zeros(N)
for ini, fin, g in [(5.5, 13.3, 0.5), (13, 22.3, 0.6), (28.6, 32.3, 0.6), (32, 43.3, 0.35), (43, 56.3, 0.35), (56, 61.6, 0.4)]:
    env_m = np.maximum(env_m, ventana(N, ini, fin, 0.6) * g)
amb += pan(mm * env_m, -0.1) * 0.35 + pan(murmullo(DUR, 5) * env_m, 0.3) * 0.3
lejano = np.zeros(N)
r = np.random.default_rng(11)
tt = 5.5
while tt < 61.5:
    if not (22.0 < tt < 28.6):
        g = golpe_cincel(r.uniform(0.2, 0.5), int(tt * 100))
        colocar(amb, lp(g, 2500), tt, 0.08 if tt < 13 or tt > 22 else 0.16, p=r.uniform(-0.8, 0.8))
    tt += r.uniform(0.12, 0.45)

# ---------- ESCENA 1 ----------
colocar(ev, whoosh(1.8, 200, 2500, 0.55), 0.0, 0.35)
colocar(ev, roce_piedra(1.8, 0.6, 2) * 1.2, 3.9, 0.35)      # la pirámide se desarma

# ---------- ESCENA 3: cantera (tiempos idénticos a la animación) ----------
T_PAL = 18.3
for i in range(3):
    frec, desf = 1.25 + i * 0.13, 0.2 + i * 0.31
    k = 0
    while True:
        tg = (k + 0.82 - desf) / frec
        k += 1
        if tg < 13.0: continue
        if tg >= T_PAL: break
        cerca = 0.35 if tg < 15.2 else (1.0 if i == 0 else 0.6)
        colocar(ev, golpe_cincel(1.0, k * 7 + i), tg, 0.55 * cerca, p=[-0.15, -0.5, 0.45][i])
# palancas: crujido en cada empuje (ciclo 0,9 s), roce del bloque y golpes al asentar
ciclo = 0.9
tt = T_PAL
j = 0
while tt < 20.9:
    colocar(ev, crujido(0.45, 620 + 80 * (j % 2), seed=j), tt + 0.1, 0.35, p=-0.3)
    colocar(ev, roce_piedra(0.4, 0.8, seed=j) * 0.8, tt + 0.15, 0.45, p=0.1)
    tt += ciclo; j += 1
colocar(ev, roce_piedra(1.9, 1.0, 5), 19.0, 0.5)
for tt, g in [(19.3, 0.6), (20.95, 0.8)]:
    tg = t_arr(0.5)
    colocar(ev, lp(np.random.default_rng(int(tt)).standard_normal(len(tg)), 300) * np.exp(-tg * 14) * 2.5, tt, g)
colocar(ev, crujido(1.1, 450, (20, 70), 9), 21.0, 0.45, p=0.3)   # cuerdas que se tensan
colocar(ev, pasos(1.0, 2.0, 3, 8), 21.1, 0.5, p=0.3)

# ---------- ESCENA 4: Nilo ----------
ag = olas(10.5, 2)
colocar(amb, ag * ventana(len(ag), 0, 10.3, 0.6), 21.8, 0.55)
colocar(amb, pan(olas(10.5, 4), 0.5) * ventana(len(ag), 0, 10.3, 0.6), 21.8, 0.35)
colocar(amb, pajaros(10, 3, 10), 22.0, 0.45, p=0.4)
colocar(ev, vela(3.4, 2), 22.0, 0.3, p=-0.2)
# remos del barco protagonista: entrada al agua cuando frac(t·0,55) = 0,75
k = 0
while True:
    te = (k + 0.75) / 0.55; k += 1
    if te < 22.0: continue
    if te > 28.8: break
    g = 0.7 if 25.2 <= te < 28.6 else 0.25
    colocar(ev, salpicadura(k, 1.0), te, 0.45 * g, p=0.2)
    colocar(ev, salpicadura(k + 50, 0.7), te + 0.03, 0.35 * g, p=-0.2)
    colocar(ev, crujido(0.35, 380, (25, 60), k), te - 0.2, 0.18 * g)       # escálamo
colocar(ev, crujido(3.2, 300, (15, 40), 77), 28.7, 0.35, p=0.2)            # tablón y trineo
colocar(ev, roce_piedra(3.0, 0.7, 8), 28.8, 0.4)
colocar(ev, pasos(3.3, 2.2, 5, 10), 28.6, 0.45, p=-0.2)

# ---------- ESCENA 5: trineo ----------
colocar(ev, arrastre_arena(4.8, False, 1), 31.8, 0.45)
colocar(ev, pasos(4.6, 2.3, 7, 20), 31.9, 0.55)
ch = chorro(4.6, 3)
colocar(ev, ch * np.concatenate([np.full(int(2.7 * SR), 0.35), np.full(len(ch) - int(2.7 * SR), 1.0)]), 32.0, 0.45, p=0.15)
# comparación: seco (izquierda) vs. húmedo (derecha)
colocar(ev, arrastre_arena(6.7, True, 4), 36.3, 0.38, p=0.35)
colocar(ev, arrastre_arena(6.7, False, 5), 36.3, 0.35, p=-0.35)
colocar(ev, chorro(6.6, 6), 36.4, 0.25, p=-0.4)
colocar(ev, pasos(6.6, 2.0, 9, 30), 36.4, 0.4)
for i, tt in enumerate([37.0, 37.18, 37.36, 37.54]):
    colocar(ev, pop(i, 800 + i * 120), tt, 0.35)
colocar(ev, pop(9, 520) * 1.3, 37.8, 0.45)
colocar(ev, whoosh(0.8, 800, 5000, 0.3), 39.9, 0.25)

# ---------- ESCENA 6: rampas ----------
colocar(ev, crujido(4.0, 420, (10, 35), 21), 43.2, 0.25, p=-0.4)
colocar(ev, roce_piedra(4.0, 0.6, 22), 43.2, 0.25, p=0.4)
ciclo = 1.6
for j in range(2):
    tp = 47.3 + (j + 0.25) * ciclo - 0.3
    colocar(ev, crujido(0.8, 560, seed=30 + j), tp, 0.5, p=-0.25)
    colocar(ev, crujido(0.8, 640, seed=40 + j), tp + 0.05, 0.4, p=0.25)
    colocar(ev, roce_piedra(0.9, 1.0, seed=50 + j), tp + 0.2, 0.55)
colocar(ev, pasos(3.0, 1.6, 12, 4), 47.3, 0.35)
for i, tt in enumerate([50.7, 52.3, 53.9]):
    colocar(ev, destello(1.5, i), tt - 0.05, 0.5, p=[-0.3, 0.0, 0.3][i])

# ---------- ESCENA 7 ----------
colocar(ev, roce_piedra(3.0, 0.5, 60) * 0.7, 59.8, 0.25)       # alisado del revestimiento
colocar(amb, grillos(4.2, 2), 66.0, 0.6)
c = ciudad(4.4, 3)
colocar(amb, c * ventana(len(c), 0, 4.2, 1.0), 66.0, 0.5)

# ---------- transiciones ----------
for tt, g in [(13.0, 0.25), (22.0, 0.25), (32.0, 0.25), (43.0, 0.3), (56.0, 0.3), (25.2, 0.12), (28.6, 0.12), (34.7, 0.1), (36.4, 0.12), (47.3, 0.12), (50.3, 0.18)]:
    colocar(ev, whoosh(0.9, 300, 3500, 0.6), tt - 0.6, g)

ir = ir_sala(1.6, 1.1, 7000, seed=9)
sfx = reverb(amb, ir, 0.2) + reverb(ev, ir, 0.18)
sfx = np.stack([hp(ch_, 35) for ch_ in sfx])
fin = int(69.4 * SR)
sfx[:, fin:] *= np.linspace(1, 0, N - fin) ** 1.5
sfx /= np.max(np.abs(sfx)) + 1e-9
sfx *= 0.89
sf.write(os.path.join(OUT, 'efectos.wav'), sfx.T, SR)
print('efectos.wav', sfx.shape[1] / SR, 's')
