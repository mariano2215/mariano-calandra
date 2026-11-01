#!/usr/bin/env bash
# Une los cuadros renderizados con la mezcla de audio en un MP4 vertical H.264 (1080×1920, 30 fps)
# y genera además una versión con subtítulos SRT como pista seleccionable (además de los quemados).
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
CUADROS="$RAIZ/salida/cuadros"
AUDIO="$RAIZ/audio/build/mezcla_final.wav"
SALIDA="$RAIZ/salida"

total=$(ls "$CUADROS"/c*.jpg | wc -l)
if [ "$total" -lt 2100 ]; then echo "Faltan cuadros: $total/2100"; exit 1; fi

ffmpeg -hide_banner -y -framerate 30 -i "$CUADROS/c%05d.jpg" -i "$AUDIO" \
  -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 19 -maxrate 10M -bufsize 20M -profile:v high -level 4.2 -pix_fmt yuv420p \
  -vf "scale=1080:1920:flags=lanczos,format=yuv420p" \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 192k -ar 48000 -t 70 -movflags +faststart \
  -metadata title="¿Cómo construyeron las pirámides? — Reconstrucción animada" \
  -metadata language=spa \
  "$SALIDA/piramides_guiza_1080x1920.mp4"

# Variante con pista de subtítulos SRT incrustada (mov_text), útil para reproductores
ffmpeg -hide_banner -y -i "$SALIDA/piramides_guiza_1080x1920.mp4" -i "$SALIDA/subtitulos.srt" \
  -map 0 -map 1 -c copy -c:s mov_text -metadata:s:s:0 language=spa \
  "$SALIDA/piramides_guiza_1080x1920_con_pista_srt.mp4"

ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,duration:format=duration,size -of compact "$SALIDA/piramides_guiza_1080x1920.mp4"
