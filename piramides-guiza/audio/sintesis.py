"""Bloques de síntesis de audio (sin muestras externas): osciladores aditivos, envolventes,
filtros, reverberación por convolución con respuesta impulsiva sintética, ruido coloreado."""
import numpy as np
from scipy import signal

SR = 48000
RNG = np.random.default_rng(2560)


def t_arr(dur):
    return np.arange(int(dur * SR)) / SR


def env_adsr(n, a=0.01, d=0.1, s=0.7, r=0.2):
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    s_n = max(0, n - a_n - d_n - r_n)
    e = np.concatenate([np.linspace(0, 1, max(1, a_n)), np.linspace(1, s, max(1, d_n)), np.full(s_n, s), np.linspace(s, 0, max(1, r_n))])
    if len(e) < n:
        e = np.pad(e, (0, n - len(e)))
    return e[:n]


def nota(f):
    """Nombre de nota (ej. 'D3', 'Eb4', 'F#2') → Hz"""
    nombres = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
    if isinstance(f, (int, float)):
        return float(f)
    n, o = f[:-1], int(f[-1])
    midi = 12 * (o + 1) + nombres[n]
    return 440.0 * 2 ** ((midi - 69) / 12)


def sierra_aditiva(f, dur, max_hz=5000, detune_cents=0.0, fase=None, vib=0.0, vib_hz=5.0):
    t = t_arr(dur)
    f = f * 2 ** (detune_cents / 1200)
    ph = 2 * np.pi * f * t
    if vib:
        ph += vib * np.sin(2 * np.pi * vib_hz * t) * 2 * np.pi * f / (2 * np.pi * vib_hz) * 0.01
    out = np.zeros_like(t)
    kmax = max(1, int(max_hz / f))
    rng = np.random.default_rng(int(f * 100) % 9999)
    for k in range(1, kmax + 1):
        out += np.sin(k * ph + (fase if fase is not None else rng.uniform(0, 6.28))) / k
    return out * 0.6


def cuerdas(f, dur, voces=5, ancho=12, max_hz=3200, ataque=0.6, rel=0.8, brillo=1.0):
    """Ensamble de cuerdas: sierras desafinadas + filtro pasa bajos + envolvente lenta."""
    out = np.zeros(int(dur * SR))
    for v in range(voces):
        det = (v - (voces - 1) / 2) / max(1, (voces - 1) / 2) * ancho
        out += sierra_aditiva(f, dur, max_hz=max_hz * brillo, detune_cents=det)
    out /= voces
    out *= env_adsr(len(out), a=ataque, d=0.3, s=0.85, r=rel)
    return lp(out, min(9000, 1800 * brillo + f * 2))


def coro(f, dur, ataque=1.0, rel=1.2):
    """Coro 'aah': sierra con formantes."""
    base = np.zeros(int(dur * SR))
    for v in range(4):
        base += sierra_aditiva(f, dur, max_hz=4500, detune_cents=(v - 1.5) * 7, vib=0.6, vib_hz=5.2 + v * 0.3)
    out = np.zeros_like(base)
    for fc, bw, g in [(730, 90, 1.0), (1090, 110, 0.6), (2440, 170, 0.25), (3400, 250, 0.1)]:
        b, a = signal.butter(2, [(fc - bw) / (SR / 2), (fc + bw) / (SR / 2)], btype='band')
        out += signal.lfilter(b, a, base) * g
    return out * env_adsr(len(out), a=ataque, d=0.3, s=0.9, r=rel) * 2.2


def metal(f, dur, ataque=0.25, rel=0.5):
    """Bronces: sierra con filtro que se abre."""
    s = sierra_aditiva(f, dur, max_hz=6000) + sierra_aditiva(f, dur, max_hz=6000, detune_cents=6)
    n = len(s)
    e = env_adsr(n, a=ataque, d=0.2, s=0.8, r=rel)
    # filtro variable aproximado por mezcla de dos pasa bajos
    oscuro, claro = lp(s, 500), lp(s, 3500)
    return (oscuro * (1 - e) + claro * e) * e * 0.5


def ney(f, dur, vib=1.0):
    """Flauta ney: seno + armónicos suaves + aire filtrado, vibrato tardío."""
    t = t_arr(dur)
    vib_amt = np.clip(t / 0.5, 0, 1) * 0.006 * vib
    ph = 2 * np.pi * f * (t + vib_amt / (2 * np.pi * 5.5) * np.sin(2 * np.pi * 5.5 * t) * 6)
    s = np.sin(ph) + 0.25 * np.sin(2 * ph) + 0.08 * np.sin(3 * ph)
    aire = bp(RNG.standard_normal(len(t)), f * 0.9, f * 2.5) * 0.35
    e = env_adsr(len(t), a=0.12, d=0.2, s=0.8, r=0.25)
    return (s + aire) * e * 0.45


def arpa(f, dur=2.5, brillo=0.5):
    """Karplus-Strong."""
    n = int(dur * SR)
    p = int(SR / f)
    buf = RNG.uniform(-1, 1, p)
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * (0.993 + 0.006 * brillo)
    return out * 0.5


def taiko(dur=1.6, f0=58, golpe=1.0):
    t = t_arr(dur)
    f = f0 + (f0 * 1.6) * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    cuerpo = np.sin(ph) * np.exp(-t * 3.2)
    piel = lp(RNG.standard_normal(len(t)) * np.exp(-t * 35), 1800) * 0.6
    return (cuerpo + piel) * golpe


def dum(dur=0.6):
    t = t_arr(dur)
    f = 95 + 60 * np.exp(-t * 40)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)


def tek(dur=0.15):
    t = t_arr(dur)
    return hp(RNG.standard_normal(len(t)), 2500) * np.exp(-t * 60) * 0.5 + np.sin(2 * np.pi * 1900 * t) * np.exp(-t * 70) * 0.25


def impacto(dur=4.0, sub=38):
    t = t_arr(dur)
    f = sub + 70 * np.exp(-t * 12)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    crack = lp(RNG.standard_normal(len(t)) * np.exp(-t * 18), 5000) * 0.7
    cola = lp(RNG.standard_normal(len(t)) * np.exp(-t * 2.2), 900) * 0.25
    return s + crack + cola


def subida(dur=2.0, f0=200, f1=4000):
    """Riser: ruido con banda ascendente + tono que sube."""
    n = int(dur * SR)
    ruido = RNG.standard_normal(n)
    out = np.zeros(n)
    seg = 24
    for i in range(seg):
        a, b = i * n // seg, (i + 1) * n // seg
        fc = f0 * (f1 / f0) ** (i / seg)
        out[a:b] = bp(ruido, fc * 0.7, min(fc * 1.4, 20000))[a:b]
    e = np.linspace(0, 1, n) ** 2
    t = t_arr(dur)
    tono = np.sin(2 * np.pi * np.cumsum(f0 * 0.5 * (f1 / f0 / 4) ** (t / dur)) / SR) * 0.2
    return (out + tono) * e


def whoosh(dur=1.0, fc0=300, fc1=3000, pico=0.6):
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    ruido = RNG.standard_normal(n)
    out = np.zeros(n)
    seg = 20
    for i in range(seg):
        a, b = i * n // seg, (i + 1) * n // seg
        fc = fc0 * (fc1 / fc0) ** (i / seg)
        out[a:b] = bp(ruido, fc * 0.6, min(fc * 1.6, 20000))[a:b]
    e = np.where(t < pico, (t / pico) ** 2, ((1 - t) / (1 - pico)) ** 1.5)
    return out * e


def ruido_rosa(n):
    b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
    a = [1, -2.494956002, 2.017265875, -0.522189400]
    return signal.lfilter(b, a, RNG.standard_normal(n)) * 4


def lp(x, fc, orden=2):
    b, a = signal.butter(orden, min(fc, SR / 2 - 100) / (SR / 2), btype='low')
    return signal.lfilter(b, a, x)


def hp(x, fc, orden=2):
    b, a = signal.butter(orden, fc / (SR / 2), btype='high')
    return signal.lfilter(b, a, x)


def bp(x, f1, f2, orden=2):
    f1 = max(20, f1); f2 = min(f2, SR / 2 - 200)
    b, a = signal.butter(orden, [f1 / (SR / 2), f2 / (SR / 2)], btype='band')
    return signal.lfilter(b, a, x)


def ir_sala(dur=3.0, decaimiento=2.2, brillo=4000, seed=1):
    """Respuesta impulsiva estéreo sintética (reverberación de sala grande)."""
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    ir = []
    for c in range(2):
        r = rng.standard_normal(n) * np.exp(-t * 6.9 / decaimiento)
        r = lp(r, brillo)
        r[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
        ir.append(r / np.sqrt(np.sum(r ** 2)))
    return np.stack(ir)


def reverb(est, ir, mezcla=0.3):
    """est: array (2, n)."""
    out = np.stack([signal.fftconvolve(est[c], ir[c])[: est.shape[1]] for c in range(2)])
    return est * (1 - mezcla) + out * mezcla


def pan(mono, p=0.0):
    """p en [-1, 1] → estéreo con ley de potencia constante."""
    a = (p + 1) * np.pi / 4
    return np.stack([mono * np.cos(a), mono * np.sin(a)])


def colocar(bus, x, t0, ganancia=1.0, p=0.0):
    """Suma x (mono o estéreo) en el bus estéreo a partir de t0 s."""
    if x.ndim == 1:
        x = pan(x, p)
    i = int(t0 * SR)
    if i >= bus.shape[1]:
        return
    if i < 0:
        x = x[:, -i:]; i = 0
    n = min(x.shape[1], bus.shape[1] - i)
    bus[:, i:i + n] += x[:, :n] * ganancia
