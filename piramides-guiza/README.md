# ¿Cómo construyeron las pirámides? — Reconstrucción animada (9:16)

Video documental vertical de 70 s (1080 × 1920, 30 fps, H.264) que explica cómo se construyó la
Gran Pirámide de Guiza. Todo se genera desde código en este repositorio: escenas 3D en Three.js
renderizadas cuadro a cuadro, narración con TTS local, música y efectos sintetizados, subtítulos
dinámicos y SRT.

## Entregables (`salida/`)

| Archivo | Contenido |
|---|---|
| `piramides_guiza_1080x1920.mp4` | Video final H.264 + AAC, subtítulos integrados (quemados) |
| `piramides_guiza_1080x1920_con_pista_srt.mp4` | Igual, con pista SRT seleccionable adicional |
| `subtitulos.srt` | Subtítulos en español, sincronizados con la narración |
| `portada_1080x1920.png` | Portada vertical «¿CÓMO CONSTRUYERON LAS PIRÁMIDES?» |
| `narracion.wav`, `musica.wav`, `efectos.wav`, `mezcla_final.wav` | Pistas de audio separadas (stems) |

## Estructura del proyecto

```
narracion/   guion.json (texto y tiempos) · generar_narracion.py (TTS + tiempos por palabra + SRT)
audio/       sintesis.py (instrumentos y DSP) · musica.py · efectos.py · mezcla.py (ducking + -14 LUFS)
escena/      index.html · src/ (motor Three.js)
  src/main.js         render determinista: renderCuadro(f) depende solo de t = f / 30
  src/mundo.js        cielo procedural, sol, niebla, meseta, cantera, puerto, valle del Nilo, ciudad actual
  src/piramide.js     hiladas, hilada en curso, revestimiento, rampas e hipótesis alternativas
  src/obra.js         convoyes de trineos, cuadrillas, palancas
  src/trabajadores.js multitud articulada (caminar, tirar, cincelar, verter, palanca, remar…)
  src/cantera.js · src/objetos.js · src/texturas.js · src/post.js · src/texto.js
  src/escenas/        un archivo por escena (planos, cámaras, textos en pantalla)
render/      servidor.mjs · render.mjs (Chromium sin interfaz) · codificar.sh (ffmpeg)
```

## Cómo regenerar

Requisitos: Node 22, Python 3.11+, ffmpeg (con libx264), Chromium + Playwright.

```bash
npm install                                    # three, fuentes Cinzel y Montserrat
pip install kokoro-onnx soundfile numpy scipy  # voz y audio
# Modelos de voz Kokoro (kokoro-v1.0.onnx, voices-v1.0.bin) en $KOKORO_DIR (por defecto /root/models)

python3 narracion/generar_narracion.py         # voz (em_alex, fonemas es-419), timeline.json y SRT
python3 audio/musica.py && python3 audio/efectos.py && python3 audio/mezcla.py

npm run preview                                # http://127.0.0.1:8080/escena/index.html?auto=1&t=0
node render/render.mjs --tiempos 4,15,40 --salida /tmp/previas      # cuadros sueltos (PNG)
node render/render.mjs --desde 0 --hasta 2100 --procesos 2           # 2100 cuadros JPEG
bash render/codificar.sh                                             # MP4 final
```

Parámetros útiles de la página: `?w=540&h=960` (resolución), `msaa=0`, `subs=0` (sin subtítulos).

## Guion y sincronización

| Escena | Tiempo | Plano(s) |
|---|---|---|
| 1. El misterio | 0–5 s | Sobrevuelo actual → rebobinado temporal (2026 d. C. → 2560 a. C.) |
| 2. El comienzo | 5–13 s | Cimientos y time-lapse de las primeras hiladas |
| 3. Extraer la piedra | 13–22 s | Plano continuo: cantera → cincel de cobre → bloque al trineo |
| 4. El Nilo | 22–32 s | Río y velero · barco a remo con caliza de Tura · descarga en el puerto |
| 5. Sin ruedas | 32–43 s | Trineo y aguador · comparación arena seca / húmeda |
| 6. Subir los bloques | 43–56 s | Rampa hipotética · palancas · ¿recta? ¿zigzag? ¿espiral? |
| 7. El resultado | 56–70 s | Time-lapse final, revestimiento, atardecer → Guiza actual |

Los golpes de cincel, los crujidos de palanca y las salpicaduras de los remos del audio usan
exactamente las mismas fórmulas de tiempo que la animación (`audio/efectos.py` ↔ `escena/src/escenas/`).

## Rigor histórico: evidencia vs. hipótesis

**Respaldado por evidencia**
- Altura original ≈ 146,6 m (hoy ≈ 138,5 m), base ≈ 230 m; reinado de Keops, IV dinastía (c. 2560 a. C.).
- La mayor parte de la caliza del núcleo se extrajo en canteras de la propia meseta, al sur de la pirámide;
  herramientas de cobre, mazos de madera y palancas.
- Transporte fluvial: el *Diario de Merer* (papiros de Wadi al-Jarf, hallados en 2013; P. Tallet) registra
  el traslado en barco de caliza de Tura hasta Guiza en el año 27 de Keops. Estudios paleoambientales
  (Sheisha et al., *PNAS*, 2022) describen un brazo del Nilo y un puerto junto a la meseta.
- Trineos y agua: la tumba de Dyehutihotep (c. 1900 a. C.) muestra una estatua sobre un trineo mientras un
  hombre vierte líquido delante. En laboratorio, la arena con la humedad adecuada reduce
  aproximadamente a la mitad la fuerza de arrastre (Fall et al., *Physical Review Letters* 112, 175502, 2014).
- Mano de obra organizada (aldea de trabajadores de Guiza, excavaciones de M. Lehner y Z. Hawass).

**Hipótesis (señaladas en el video como «RECONSTRUCCIÓN HIPOTÉTICA»)**
- El diseño de las rampas (recta, en zigzag, en espiral, interna o combinaciones). Hay indicios de rampas
  con escaleras y postes en la cantera de Hatnub (2018), pero no un diseño probado para Guiza.
- El alisado del revestimiento de arriba hacia abajo mientras se desmontaba la rampa.
- El orden concreto de colocación de los bloques y la organización de las cuadrillas que se muestra.

**Simplificaciones de la reconstrucción**
- Se usan 146 hiladas de ≈1 m (las reales son unas 200, de altura variable) y bloques de tamaño similar.
- El tiempo está comprimido (time-lapse) y la geografía del puerto y del valle está simplificada.
- Las personas son figuras articuladas procedurales (ver «Limitaciones»).

## Limitaciones técnicas (honestas)

- No hubo acceso a generación de video con IA ni a modelos humanos con captura de movimiento, así que los
  trabajadores son figuras 3D articuladas por código (cinemática directa). Para disimularlo, los planos
  humanos se mantienen a media distancia, con profundidad de campo, polvo y contraluz. Es una
  reconstrucción animada estilizada, no fotorrealismo de nivel cinematográfico.
- El render es por software (SwiftShader, sin GPU): ≈ 2–4 s por cuadro.
- La voz es sintética (Kokoro TTS local, voz masculina «em_alex», pronunciación latinoamericana), procesada
  para un timbre más grave. La música y los efectos son originales, sintetizados por código (sin muestras).
