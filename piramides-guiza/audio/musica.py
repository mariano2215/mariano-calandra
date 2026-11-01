#!/usr/bin/env python3
"""Música original (70 s) en Re hijaz / Re menor, sincronizada con las escenas.
Estructura: misterio (0–5) · comienzo (5–13) · cantera (13–22) · Nilo (22–32) ·
trineo (32–43) · rampas y misterio (43–56) · final épico y resolución (56–70)."""
import os
import numpy as np
import soundfile as sf
from sintesis import (SR, nota, cuerdas, coro, metal, ney, arpa, taiko, dum, tek, impacto, subida, whoosh,
                      ruido_rosa, lp, hp, bp, ir_sala, reverb, colocar, pan, t_arr, env_adsr)

DUR = 70.0
AQUI = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(AQUI, 'build')
os.makedirs(OUT, exist_ok=True)

N = int(DUR * SR)
pads = np.zeros((2, N))     # cuerdas, coro, bronces
perc = np.zeros((2, N))     # percusión
melo = np.zeros((2, N))     # ney, arpa
fx = np.zeros((2, N))       # impactos, subidas


def acorde(bus, notas, t0, dur, inst='cuerdas', g=0.25, **kw):
    for i, n in enumerate(notas):
        f = nota(n)
        if inst == 'cuerdas':
            x = cuerdas(f, dur, **kw)
        elif inst == 'coro':
            x = coro(f, dur, **kw)
        else:
            x = metal(f, dur, **kw)
        colocar(bus, x, t0, g, p=(i / max(1, len(notas) - 1) - 0.5) * 0.7)


BEAT = 0.625  # 96 ppm

# ---------------- 0–5: misterio ----------------
acorde(pads, ['D2', 'A2', 'D3'], 0.0, 5.6, g=0.22, ataque=1.2, rel=1.0, brillo=0.6)
colocar(fx, impacto(4.0, 36), 0.12, 0.55)
for k, tt in enumerate([0.9, 1.55, 2.2, 2.85]):   # latido grave creciente
    colocar(perc, taiko(1.2, 52, 0.5 + k * 0.12), tt, 0.5)
colocar(fx, subida(1.2, 300, 6000), 2.15, 0.22)
# rebobinado: barrido descendente + impacto
colocar(fx, whoosh(1.6, 6000, 200, 0.15), 3.25, 0.35)
colocar(fx, impacto(3.5, 32), 3.3, 0.6)
# tic-tac del contador de años
for i in range(24):
    tt = 3.35 + i * (1.9 / 24) * (1 + i / 40)
    colocar(fx, hp(tek(0.06), 3000), tt, 0.12, p=0.2)

# ---------------- 5–13: el comienzo (tema) ----------------
prog = [(['D2', 'A2', 'D3', 'F#3'], 5.0), (['Eb2', 'G2', 'Bb2', 'Eb3'], 7.5), (['C2', 'G2', 'C3', 'Eb3'], 10.0), (['D2', 'A2', 'D3', 'F#3'], 11.9)]
for i, (ac, t0) in enumerate(prog):
    fin = prog[i + 1][1] if i + 1 < len(prog) else 13.4
    acorde(pads, ac, t0, fin - t0 + 0.6, g=0.2, ataque=0.5, rel=0.7, brillo=0.8)
# ostinato de violonchelo (corcheas) en Re
t0 = 5.0
while t0 < 13.0:
    for i, n in enumerate(['D2', 'D2', 'A2', 'D2', 'Eb2', 'D2', 'A2', 'D2']):
        tt = t0 + i * BEAT / 2
        if tt >= 13.0: break
        x = cuerdas(nota(n), BEAT / 2 + 0.1, voces=3, ataque=0.01, rel=0.08, brillo=0.7)
        colocar(pads, x, tt, 0.17, p=-0.2)
    t0 += 4 * BEAT
# percusión: dum-tek
for i in range(int(8.0 / BEAT)):
    tt = 5.0 + i * BEAT
    colocar(perc, dum(), tt, 0.35 if i % 2 == 0 else 0.22)
    colocar(perc, tek(), tt + BEAT / 2, 0.18, p=0.3)
    if i % 4 == 0:
        colocar(perc, taiko(1.5, 60, 0.7), tt, 0.45)
# melodía ney (hijaz): D Eb F# G A ...
mel = [('A4', 6.25, 0.9), ('G4', 7.15, 0.45), ('F#4', 7.6, 0.45), ('Eb4', 8.05, 0.9), ('D4', 8.95, 1.6),
       ('F#4', 10.6, 0.6), ('G4', 11.2, 0.6), ('A4', 11.8, 1.2)]
for n, tt, d in mel:
    colocar(melo, ney(nota(n), d + 0.2), tt, 0.32, p=0.15)

# ---------------- 13–22: la cantera ----------------
colocar(fx, impacto(3.0, 40), 13.0, 0.35)
acorde(pads, ['D2', 'A2', 'D3', 'F3'], 13.0, 4.6, g=0.18, ataque=0.4, brillo=0.7)
acorde(pads, ['Bb1', 'F2', 'Bb2', 'D3'], 17.5, 2.6, g=0.18, ataque=0.4, brillo=0.7)
acorde(pads, ['A1', 'E2', 'A2', 'C#3'], 20.0, 2.5, g=0.18, ataque=0.3, brillo=0.8)
for i in range(int(9.0 / BEAT)):
    tt = 13.0 + i * BEAT
    colocar(perc, dum(), tt, 0.3 if i % 2 == 0 else 0.18)
    if i % 2 == 1:
        colocar(perc, tek(), tt + BEAT / 4, 0.12, p=-0.3)
    if i % 4 == 0:
        colocar(perc, taiko(1.4, 62, 0.6), tt, 0.4)
for n, tt, d in [('D4', 15.0, 0.8), ('Eb4', 15.9, 0.5), ('D4', 16.4, 1.2), ('A4', 18.4, 1.0), ('Bb4', 19.5, 0.6), ('A4', 20.1, 1.4)]:
    colocar(melo, ney(nota(n), d + 0.2), tt, 0.26, p=0.15)
colocar(fx, subida(1.4, 200, 3000), 20.7, 0.18)

# ---------------- 22–32: el Nilo (fluido) ----------------
colocar(fx, whoosh(1.2, 400, 4000, 0.4), 21.6, 0.2)
acorde(pads, ['F2', 'C3', 'F3', 'A3'], 22.0, 3.4, g=0.17, ataque=0.8, brillo=0.9)
acorde(pads, ['D2', 'A2', 'D3', 'F3'], 25.2, 3.6, g=0.17, ataque=0.6, brillo=0.9)
acorde(pads, ['Bb1', 'F2', 'D3', 'F3'], 28.6, 2.0, g=0.17, ataque=0.5, brillo=0.9)
acorde(pads, ['C2', 'G2', 'C3', 'E3'], 30.4, 2.0, g=0.17, ataque=0.4, brillo=0.9)
arpegio = ['D4', 'F4', 'A4', 'D5', 'A4', 'F4']
for i in range(int(10.0 / (BEAT / 2))):
    tt = 22.0 + i * BEAT / 2
    seccion = 0 if tt < 25.2 else 1 if tt < 28.6 else 2
    base = [['F4', 'A4', 'C5', 'F5', 'C5', 'A4'], ['D4', 'F4', 'A4', 'D5', 'A4', 'F4'], ['D4', 'F4', 'Bb4', 'D5', 'Bb4', 'F4']][seccion]
    colocar(melo, arpa(nota(base[i % 6]), 1.6, 0.6), tt, 0.16, p=0.4 * np.sin(i))
for i in range(int(10.0 / BEAT)):
    tt = 22.0 + i * BEAT
    if i % 2 == 0:
        colocar(perc, dum(0.5), tt, 0.16)
colocar(fx, subida(1.5, 200, 5000), 30.6, 0.2)

# ---------------- 32–43: trineo (impulso) ----------------
colocar(fx, impacto(3.0, 40), 32.0, 0.4)
for ac, t0, d in [(['D2', 'A2', 'D3', 'F3'], 32.0, 2.8), (['Bb1', 'F2', 'Bb2', 'D3'], 34.7, 1.8), (['G1', 'D2', 'G2', 'Bb2'], 36.4, 3.2), (['A1', 'E2', 'A2', 'C#3'], 39.6, 3.6)]:
    acorde(pads, ac, t0, d + 0.5, g=0.19, ataque=0.3, brillo=0.9)
for i in range(int(11.0 / (BEAT / 2))):
    tt = 32.0 + i * BEAT / 2
    n = ['D2', 'D2', 'F2', 'D2', 'G2', 'D2', 'A2', 'Bb2'][i % 8]
    colocar(pads, cuerdas(nota(n), BEAT / 2 + 0.08, voces=3, ataque=0.01, rel=0.06, brillo=0.8), tt, 0.15, p=-0.25)
for i in range(int(11.0 / BEAT)):
    tt = 32.0 + i * BEAT
    colocar(perc, taiko(1.2, 58, 0.55 if i % 2 == 0 else 0.35), tt, 0.4)
    colocar(perc, tek(), tt + BEAT / 2, 0.14, p=0.25)

# ---------------- 43–56: rampas · misterio ----------------
colocar(fx, impacto(3.5, 36), 43.0, 0.45)
for ac, t0, d in [(['D2', 'A2', 'D3', 'F3', 'A3'], 43.0, 2.5), (['Eb2', 'Bb2', 'Eb3', 'G3'], 45.5, 2.5), (['C2', 'G2', 'C3', 'Eb3', 'G3'], 48.0, 2.5)]:
    acorde(pads, ac, t0, d + 0.5, g=0.18, ataque=0.25, brillo=1.0)
    acorde(pads, [ac[2], ac[3]], t0, d + 0.4, inst='metal', g=0.08, ataque=0.5, rel=0.4)
for i in range(int(7.4 / BEAT)):
    tt = 43.0 + i * BEAT
    colocar(perc, taiko(1.3, 60, 0.6 + 0.05 * (i % 4 == 0)), tt, 0.42)
    colocar(perc, dum(), tt + BEAT / 2, 0.2)
    if i % 2:
        colocar(perc, tek(), tt + BEAT * 0.75, 0.15)
colocar(fx, subida(1.0, 300, 7000), 49.4, 0.2)
# 50.4: caída al misterio — acorde suspendido, coro, pulsos lejanos
colocar(fx, impacto(5.0, 30), 50.4, 0.5)
acorde(pads, ['D3', 'G3', 'A3'], 50.4, 5.8, inst='coro', g=0.16, ataque=1.0, rel=1.2)
acorde(pads, ['D2', 'A2'], 50.4, 5.8, g=0.18, ataque=0.8, rel=1.0, brillo=0.5)
for tt in [50.7, 52.3, 53.9]:
    colocar(melo, arpa(nota('A5'), 2.2, 0.9), tt, 0.14, p=0.5)
    colocar(melo, arpa(nota('Eb5'), 2.2, 0.9), tt + 0.12, 0.12, p=-0.5)
    colocar(perc, taiko(1.6, 50, 0.5), tt, 0.3)
colocar(fx, subida(1.8, 150, 8000), 54.3, 0.3)

# ---------------- 56–70: final ----------------
colocar(fx, impacto(4.0, 34), 56.0, 0.6)
fin_prog = [(['D2', 'A2', 'D3', 'F#3', 'A3'], 56.0, 2.0), (['Eb2', 'Bb2', 'Eb3', 'G3', 'Bb3'], 58.0, 2.0),
            (['C2', 'G2', 'C3', 'Eb3', 'G3'], 60.0, 1.9), (['D2', 'A2', 'D3', 'F#3', 'A3'], 61.9, 2.2),
            (['Bb1', 'F2', 'Bb2', 'D3', 'F3'], 64.1, 2.2)]
for ac, t0, d in fin_prog:
    acorde(pads, ac, t0, d + 0.6, g=0.2, ataque=0.25, brillo=1.1)
    acorde(pads, ac[2:], t0, d + 0.6, inst='coro', g=0.1, ataque=0.4, rel=0.6)
    acorde(pads, ac[1:3], t0, d + 0.4, inst='metal', g=0.09, ataque=0.3)
for i in range(int(10.3 / BEAT)):
    tt = 56.0 + i * BEAT
    fuerte = tt < 61.9
    colocar(perc, taiko(1.4, 56, 0.75 if i % 2 == 0 else 0.45), tt, 0.48 if fuerte else 0.32)
    colocar(perc, dum(), tt + BEAT / 2, 0.22 if fuerte else 0.14)
for n, tt, d in [('D5', 56.6, 1.2), ('Eb5', 57.9, 0.6), ('F#5', 58.5, 0.6), ('G5', 59.1, 0.6), ('A5', 59.7, 1.6), ('G5', 62.2, 0.8), ('F#5', 63.0, 0.8), ('Eb5', 63.8, 0.6), ('D5', 64.4, 1.8)]:
    colocar(melo, ney(nota(n), d + 0.25), tt, 0.28, p=0.15)
colocar(fx, subida(2.0, 150, 7000), 64.4, 0.32)
# resolución: gran impacto con el título final y acorde de Re mayor sostenido
colocar(fx, impacto(5.5, 30), 66.4, 0.75)
acorde(pads, ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4'], 66.4, 3.8, g=0.22, ataque=0.1, rel=2.5, brillo=1.0)
acorde(pads, ['D3', 'F#3', 'A3', 'D4'], 66.4, 3.8, inst='coro', g=0.12, ataque=0.3, rel=2.5)
colocar(perc, taiko(2.5, 48, 1.0), 66.4, 0.6)

# ---------------- mezcla de la música ----------------
ir = ir_sala(3.2, 2.6, 5000)
ir_corta = ir_sala(1.4, 1.0, 6000, seed=3)
pads = reverb(pads, ir, 0.35)
melo = reverb(melo, ir, 0.4)
perc = reverb(perc, ir_corta, 0.25)
fx = reverb(fx, ir, 0.3)
mus = pads * 1.0 + perc * 0.9 + melo * 1.0 + fx * 0.9
mus = np.stack([hp(c, 28) for c in mus])
# fundido final
fin = int(69.4 * SR)
mus[:, fin:] *= np.linspace(1, 0, N - fin) ** 1.5
mus /= np.max(np.abs(mus)) + 1e-9
mus *= 0.89
sf.write(os.path.join(OUT, 'musica.wav'), mus.T, SR)
print('musica.wav', mus.shape[1] / SR, 's')
