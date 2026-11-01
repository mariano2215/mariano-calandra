#!/usr/bin/env python3
"""Mezcla final: voz + música (con ducking bajo la voz) + efectos. Normaliza a -14 LUFS
(redes sociales) con pico real -1,5 dBTP mediante ffmpeg loudnorm en dos pasadas."""
import json, os, subprocess
import numpy as np
import soundfile as sf
from scipy import signal

AQUI = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(AQUI, 'build')
SR = 48000

voz, sr = sf.read(os.path.join(AQUI, '..', 'narracion', 'build', 'narracion.wav'))
assert sr == SR
mus, _ = sf.read(os.path.join(B, 'musica.wav'))
sfx, _ = sf.read(os.path.join(B, 'efectos.wav'))
n = min(len(voz), len(mus), len(sfx))
voz, mus, sfx = voz[:n], mus[:n].T, sfx[:n].T

# envolvente de la voz (seguidor con ataque 25 ms / liberación 350 ms)
rect = np.abs(voz)
env = np.zeros(n)
a_at, a_rel = np.exp(-1 / (0.025 * SR)), np.exp(-1 / (0.35 * SR))
e = 0.0
# implementación vectorizada aproximada: suavizado por bloques de 10 ms
blk = int(0.01 * SR)
nb = n // blk
rms = np.sqrt(np.mean(rect[: nb * blk].reshape(nb, blk) ** 2, axis=1))
envb = np.zeros(nb)
for i in range(nb):
    x = rms[i]
    coef = 0.45 if x > e else 0.97
    e = coef * e + (1 - coef) * x
    envb[i] = e
env = np.repeat(envb, blk)
env = np.pad(env, (0, n - len(env)), mode='edge')
umbral = 0.02
activo = np.clip(env / umbral, 0, 1)
duck_mus = 1 - 0.62 * activo     # ≈ -8,4 dB bajo la voz
duck_sfx = 1 - 0.35 * activo

voz_st = np.stack([voz, voz])
mezcla = voz_st * 1.0 + mus * duck_mus * 0.42 + sfx * duck_sfx * 0.38
# limitador suave
pico = np.max(np.abs(mezcla))
mezcla = np.tanh(mezcla / max(pico, 1e-9) * 1.2) / np.tanh(1.2) * 0.95
pre = os.path.join(B, 'mezcla_pre.wav')
sf.write(pre, mezcla.T, SR)

# loudnorm en dos pasadas
r = subprocess.run(['ffmpeg', '-hide_banner', '-i', pre, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'],
                   capture_output=True, text=True)
txt = r.stderr
med = json.loads(txt[txt.rindex('{'): txt.rindex('}') + 1])
filtro = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={med['input_i']}:measured_TP={med['input_tp']}:"
          f"measured_LRA={med['input_lra']}:measured_thresh={med['input_thresh']}:offset={med['target_offset']}:linear=true")
final = os.path.join(B, 'mezcla_final.wav')
subprocess.run(['ffmpeg', '-hide_banner', '-y', '-i', pre, '-af', filtro, '-ar', '48000', final], check=True, capture_output=True)
print('Medición previa:', {k: med[k] for k in ('input_i', 'input_tp', 'input_lra')})
r = subprocess.run(['ffmpeg', '-hide_banner', '-i', final, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
resumen = r.stderr[r.stderr.rindex('Summary:'):]
print(resumen)
