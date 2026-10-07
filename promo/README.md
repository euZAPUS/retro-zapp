# Anuncio de ZAP Arcade (30 s)

Se genera por completo con código: jugabilidad real del arcade capturada frame a frame, composición HTML con línea de tiempo y música sintetizada.

1. **Servidor:** desde la raíz del repo, `python3 -m http.server 8765`.
2. **Captura** (`capture.js`): Playwright con reloj virtual **pausado** (si no, los juegos van ~4× más rápido). Bots juegan cada juego y se guardan los frames, el menú con distintos temas, el perfil y la actualización de la app de escritorio.
   `OUT=/ruta npm i playwright && node capture.js` (o solo algunas tomas: `node capture.js worm tetris`).
3. **Audio** (`audio.py`): `python3 audio.py $OUT/audio.wav` (solo numpy).
4. **Render** (`render.js` + `promo.html`): `OUT=/ruta node render.js` genera 900 frames de 1920×1080. Para revisar instantes sueltos: `node render.js 4.6 12.0`.
5. **Vídeo:** `ffmpeg -framerate 30 -i $OUT/render/f%04d.jpg -i $OUT/audio.wav -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -t 30 zap-arcade-promo.mp4`

Los tiempos de cada escena están en `promo.html` (`SC`) y deben coincidir con los de `audio.py` (`SCN`).
