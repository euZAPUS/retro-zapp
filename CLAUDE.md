# retro-zapp

Portfolio web estático de demos interactivas. Sin build ni dependencias: HTML/CSS/JS plano.

## Estructura
- `index.html`: home con una tarjeta por demo (cristal, inclinación 3D, brillo bajo el cursor).
- `demos/<nombre>/`: cada demo es una carpeta con su `index.html`.
- `demos/arcade/`: ZAP Arcade, una app de 13 minijuegos (se abre con `#juego` o `#juego/modo`, p. ej. `#worm/portal`).
  - `index.html`: esqueleto (cabecera, vistas hub y juego, avisos).
  - `css/arcade.css`: tokens de tema, cristal, fondos, marcos de pantalla, hub, perfil, avisos.
  - `js/core.js`: núcleo compartido (`window.ZAP`): ajustes, audio, lienzo, partículas, textos flotantes, marcador, iconos pixel, **perfil** (récords por juego y modo, XP/nivel, logros, racha, tiempo jugado), avisos y confeti.
  - `js/ui.js`: hub, navegación por hash, selector de modos, ajustes, modal de perfil.
  - `js/games/<id>.js`: un archivo por juego. Se registra con `ZAP.register({...})`.

## Cómo añadir un juego al arcade
1. Crea `js/games/<id>.js` con `ZAP.register({ id, name, tag, genre, color, icon, modes: [...], hint, ach, create(K) })`.
2. `create(K)` devuelve `{ W, H, enter(modo), setMode(modo), update(dt), draw(), key?, down?, move?, up?, controls?(el), recolor?, blur?, leave?, init? }`. Dibuja en `K.ctx` (coordenadas lógicas `W×H`); las partículas y textos flotantes (`K.burst`, `K.popText`) los pinta el núcleo.
3. Al terminar una partida llama **una vez** a `K.profile.submit(valor, extra)` (`null` = partida sin puntuación). Define la métrica en `metric` (`better: 'high' | 'low'`, `fmt`), a nivel de juego o de modo.
4. Añade un icono 10×10 en `Z.ICONS` (core.js) y el `<script>` en `index.html`.
5. Los logros propios van en `ach: [{ id, name, desc, icon, test(perfil, resultado) }]`.

## Normas
- Idioma de la interfaz y de los comentarios: español.
- Sin frameworks ni build. Rutas relativas, para que funcione en GitHub Pages bajo `/<repo>/`.
- Los colores salen de los tokens CSS (`K.COL`); nada de colores fijos en los juegos.
- Respetar `prefers-reduced-motion`, el modo bajo consumo y que el diseño sea usable en móvil (sin scroll horizontal).
- Cada juego expone `state()` de solo lectura para poder probarlo con bots.
- Probar en local con `python3 -m http.server` desde la raíz.
