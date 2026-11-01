#!/usr/bin/env python3
"""Genera la narración (TTS local Kokoro, voz masculina, fonemas es-419),
la procesa como voz de documental y calcula los tiempos por palabra para
subtítulos dinámicos y SRT.

Salidas (en narracion/build/):
  frase_XX_raw.wav, frase_XX.wav   voz por frase (cruda / procesada)
  narracion.wav                    pista completa de 70 s, 48 kHz
  timeline.json                    tiempos de frases, palabras y bloques de subtítulo
  ../../salida/subtitulos.srt      subtítulos SRT
"""
import json, os, re, subprocess, sys
import numpy as np
import soundfile as sf

AQUI = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(AQUI, "build")
SALIDA = os.path.join(AQUI, "..", "salida")
MODELOS = os.environ.get("KOKORO_DIR", "/root/models")
SR_OUT = 48000

os.makedirs(BUILD, exist_ok=True)
os.makedirs(SALIDA, exist_ok=True)
guion = json.load(open(os.path.join(AQUI, "guion.json"), encoding="utf-8"))

# Formas habladas de los números que se muestran con cifras en pantalla.
HABLADO = {"4.500": "cuatro mil quinientos", "147": "ciento cuarenta y siete"}


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def sintetizar():
    from kokoro_onnx import Kokoro
    k = Kokoro(os.path.join(MODELOS, "kokoro-v1.0.onnx"), os.path.join(MODELOS, "voices-v1.0.bin"))
    frases = []
    n = 0
    for esc in guion["escenas"]:
        for f in esc["frases"]:
            n += 1
            texto_tts = f.get("tts", f["texto"])
            audio, sr = k.create(texto_tts, voice=guion["voz"], speed=guion["velocidad"],
                                 lang=guion["idioma_fonemas"])
            raw = os.path.join(BUILD, f"frase_{n:02d}_raw.wav")
            sf.write(raw, audio, sr)
            frases.append({"n": n, "escena": esc["id"], "inicio": f["inicio"], "texto": f["texto"],
                           "tts": texto_tts, "raw": raw})
    return frases


def procesar_voz(frase):
    """Cadena de voz documental: -1,3 semitonos con formantes preservados (más grave),
    filtro de graves, calidez, presencia, compresión suave y remuestreo a 48 kHz."""
    out = os.path.join(BUILD, f"frase_{frase['n']:02d}.wav")
    filtros = ",".join([
        "aresample=48000",
        "rubberband=pitch=0.928:formant=preserved:pitchq=quality",
        "highpass=f=65",
        "equalizer=f=140:t=q:w=1.0:g=2.5",
        "equalizer=f=380:t=q:w=1.2:g=-1.5",
        "equalizer=f=3200:t=q:w=1.4:g=2.0",
        "equalizer=f=7500:t=q:w=2.0:g=-1.5",
        "acompressor=threshold=-20dB:ratio=3:attack=8:release=120:makeup=3",
        "alimiter=limit=0.89",
    ])
    run(["ffmpeg", "-y", "-i", frase["raw"], "-af", filtros, "-ac", "1", "-ar", str(SR_OUT), out])
    frase["wav"] = out
    y, _ = sf.read(out)
    frase["duracion"] = len(y) / SR_OUT
    return y


def segmentos_voz(y, sr):
    """Devuelve (inicio_habla, fin_habla, silencios_internos[(a,b)]) en segundos."""
    hop = int(sr * 0.01)
    nfr = len(y) // hop
    rms = np.array([np.sqrt(np.mean(y[i * hop:(i + 1) * hop] ** 2) + 1e-12) for i in range(nfr)])
    db = 20 * np.log10(rms + 1e-9)
    umbral = db.max() - 30
    voz = db > umbral
    idx = np.where(voz)[0]
    ini, fin = idx[0], idx[-1]
    silencios = []
    i = ini
    while i <= fin:
        if not voz[i]:
            j = i
            while j <= fin and not voz[j]:
                j += 1
            if (j - i) >= 8:  # >= 80 ms
                silencios.append((i * 0.01, j * 0.01))
            i = j
        else:
            i += 1
    fusion = []
    for a, b in silencios:
        if fusion and a - fusion[-1][1] < 0.04:
            fusion[-1] = (fusion[-1][0], b)
        else:
            fusion.append((a, b))
    return ini * 0.01, (fin + 1) * 0.01, fusion


def peso_palabra(palabra, phonemize):
    limpia = re.sub(r"[¿?¡!.,;:…\"]", "", palabra)
    hablada = HABLADO.get(limpia, limpia)
    return max(1, len(phonemize(hablada).replace(" ", "")))


def tiempos_palabras(frase, y, phonemize):
    palabras = frase["texto"].split()
    pesos = [peso_palabra(p, phonemize) for p in palabras]
    ini, fin, sil = segmentos_voz(y, SR_OUT)
    # posiciones de puntuación internas (pausas esperables)
    cortes = [i for i, p in enumerate(palabras[:-1]) if re.search(r"[,.;:?]$", p)]
    # Anclar cada signo de puntuación a la pausa detectada más cercana a su posición
    # estimada (proporcional). Si no hay una pausa cerca, se mantiene la estimación.
    tot = sum(pesos)
    acum = np.cumsum(pesos)
    anclas = []  # (indice_palabra_corte, fin_tramo, inicio_siguiente)
    usados = set()
    for c in cortes:
        t_est = ini + (fin - ini) * acum[c] / tot
        mejor, dmin = None, 0.45
        for k, (sa, sb) in enumerate(sil):
            d = abs((sa + sb) / 2 - t_est)
            if d < dmin and k not in usados:
                mejor, dmin = k, d
        if mejor is not None:
            usados.add(mejor)
            anclas.append((c, sil[mejor][0], sil[mejor][1]))
    tramos, a, t0 = [], 0, ini
    for (c, sa, sb) in anclas:
        tramos.append((a, c, t0, sa))
        a, t0 = c + 1, sb
    tramos.append((a, len(palabras) - 1, t0, fin))
    res = []
    for (a, b, t0, t1) in tramos:
        tot = sum(pesos[a:b + 1])
        t = t0
        for i in range(a, b + 1):
            d = (t1 - t0) * pesos[i] / tot
            res.append({"palabra": palabras[i], "ini": round(frase["inicio"] + t, 3),
                        "fin": round(frase["inicio"] + t + d, 3)})
            t += d
    return res, len(anclas), len(cortes)


def es_resaltada(palabra, frase_texto, idx_palabra, palabras):
    limpia = re.sub(r"[¿?¡!.,;:…\"]", "", palabra)
    for clave in guion["resaltar"]:
        partes = clave.split()
        if len(partes) == 1 and limpia.lower() == clave.lower():
            return True
        if len(partes) > 1:
            for off in range(len(partes)):
                j = idx_palabra - off
                if 0 <= j and j + len(partes) <= len(palabras):
                    seg = [re.sub(r"[¿?¡!.,;:…\"]", "", w) for w in palabras[j:j + len(partes)]]
                    if [s.lower() for s in seg] == [p.lower() for p in partes]:
                        return True
    return False


def bloques(palabras_t):
    """Agrupa palabras en bloques de subtítulo dinámico (máx. 3 palabras / 20 caracteres)."""
    out, actual = [], []
    for i, w in enumerate(palabras_t):
        actual.append(i)
        txt = " ".join(palabras_t[j]["palabra"] for j in actual)
        corte = re.search(r"[,.;:?]$", w["palabra"]) is not None
        siguiente = palabras_t[i + 1]["palabra"] if i + 1 < len(palabras_t) else ""
        if corte or len(actual) >= 3 or len(txt) + len(siguiente) + 1 > 20:
            out.append(actual)
            actual = []
    if actual:
        out.append(actual)
    return out


def srt_tiempo(t):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def main():
    from kokoro_onnx import Kokoro  # noqa: F401  (comprobación de dependencia)
    from kokoro_onnx.tokenizer import Tokenizer
    tok = Tokenizer()
    phonemize = lambda t: tok.phonemize(t, guion["idioma_fonemas"])

    frases = sintetizar()
    total = np.zeros(int(guion["duracion_total"] * SR_OUT) + SR_OUT, dtype=np.float32)
    todas_palabras, cue_list, problemas = [], [], []
    escenas = {e["id"]: e for e in guion["escenas"]}
    for i, f in enumerate(frases):
        y = procesar_voz(f)
        a = int(f["inicio"] * SR_OUT)
        total[a:a + len(y)] += y.astype(np.float32)
        f["fin"] = round(f["inicio"] + f["duracion"], 3)
        limite = frases[i + 1]["inicio"] if i + 1 < len(frases) else guion["duracion_total"]
        lim_esc = escenas[f["escena"]]["fin"] if i + 1 < len(frases) and frases[i + 1]["escena"] != f["escena"] else limite
        if f["fin"] > min(limite, lim_esc) + 0.05:
            problemas.append(f"Frase {f['n']} termina en {f['fin']:.2f}s y se superpone (límite {min(limite, lim_esc):.2f}s)")
        pt, nsil, ncort = tiempos_palabras(f, y, phonemize)
        f["pausas_detectadas"], f["pausas_esperadas"] = nsil, ncort
        palabras = [w["palabra"] for w in pt]
        for k, w in enumerate(pt):
            w["resaltar"] = es_resaltada(w["palabra"], f["texto"], k, palabras)
            w["frase"] = f["n"]
        base = len(todas_palabras)
        for b in bloques(pt):
            ini = pt[b[0]]["ini"]
            fin = pt[b[-1]]["fin"]
            cue_list.append({"ini": ini, "fin": fin, "palabras": [base + j for j in b], "frase": f["n"]})
        todas_palabras.extend(pt)

    # extender cada bloque hasta el siguiente (sin huecos dentro de una frase)
    for i, c in enumerate(cue_list):
        if i + 1 < len(cue_list) and cue_list[i + 1]["frase"] == c["frase"]:
            c["fin"] = cue_list[i + 1]["ini"]
        else:
            c["fin"] = round(c["fin"] + 0.35, 3)

    total = total[: int(guion["duracion_total"] * SR_OUT)]
    sf.write(os.path.join(BUILD, "narracion.wav"), total, SR_OUT)

    timeline = {
        "fps": 30, "duracion": guion["duracion_total"],
        "escenas": [{"id": e["id"], "titulo": e["titulo"], "inicio": e["inicio"], "fin": e["fin"]} for e in guion["escenas"]],
        "frases": [{k: f[k] for k in ("n", "escena", "inicio", "fin", "texto", "pausas_detectadas", "pausas_esperadas")} for f in frases],
        "palabras": todas_palabras,
        "bloques": cue_list,
    }
    json.dump(timeline, open(os.path.join(BUILD, "timeline.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    # copia para la escena 3D
    json.dump(timeline, open(os.path.join(AQUI, "..", "escena", "timeline.json"), "w", encoding="utf-8"), ensure_ascii=False)

    # SRT: una entrada por cláusula (cortes en coma/punto); cláusulas largas se dividen
    # en dos; cada entrada tiene como máximo 2 líneas de 42 caracteres.
    def lineas_de(ws_):
        txt = " ".join(x["palabra"] for x in ws_)
        if len(txt) <= 42:
            return [txt]
        mejor, dmin = 1, 1e9
        for k in range(1, len(ws_)):
            l1 = " ".join(x["palabra"] for x in ws_[:k])
            l2 = " ".join(x["palabra"] for x in ws_[k:])
            d = abs(len(l1) - len(l2)) if max(len(l1), len(l2)) <= 42 else 1e6 + max(len(l1), len(l2))
            if d < dmin:
                mejor, dmin = k, d
        return [" ".join(x["palabra"] for x in ws_[:mejor]), " ".join(x["palabra"] for x in ws_[mejor:])]

    eventos = []
    for f in frases:
        ws = [w for w in todas_palabras if w["frase"] == f["n"]]
        clausulas, g = [], []
        for i, w in enumerate(ws):
            g.append(w)
            if re.search(r"[,.;:?]$", w["palabra"]) or i == len(ws) - 1:
                clausulas.append(g)
                g = []
        for cl in clausulas:
            txt = " ".join(x["palabra"] for x in cl)
            partes = [cl]
            if len(txt) > 70:
                mitad, dmin = 1, 1e9
                for k in range(1, len(cl)):
                    d = abs(len(" ".join(x["palabra"] for x in cl[:k])) - len(txt) / 2)
                    if d < dmin:
                        mitad, dmin = k, d
                partes = [cl[:mitad], cl[mitad:]]
            for pt_ in partes:
                eventos.append({"ini": pt_[0]["ini"], "fin": pt_[-1]["fin"], "lineas": lineas_de(pt_), "frase": f["n"]})
    for i, e in enumerate(eventos):
        if i + 1 < len(eventos) and eventos[i + 1]["frase"] == e["frase"]:
            e["fin"] = eventos[i + 1]["ini"] - 0.02
        else:
            e["fin"] += 0.35
    srt = [f"{i + 1}\n{srt_tiempo(e['ini'])} --> {srt_tiempo(e['fin'])}\n" + "\n".join(e["lineas"]) + "\n"
           for i, e in enumerate(eventos)]
    open(os.path.join(SALIDA, "subtitulos.srt"), "w", encoding="utf-8").write("\n".join(srt))

    for f in frases:
        print(f"Frase {f['n']} [esc {f['escena']}] {f['inicio']:.2f}–{f['fin']:.2f}s ({f['duracion']:.2f}s) "
              f"pausas {f['pausas_detectadas']}/{f['pausas_esperadas']}")
    for p in problemas:
        print("AVISO:", p)
    return 1 if problemas else 0


if __name__ == "__main__":
    sys.exit(main())
