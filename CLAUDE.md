# retro-zapp

Portfolio web estático de demos interactivas. Sin build ni dependencias: HTML/CSS/JS plano.

## Estructura
- `index.html`: home con una tarjeta por demo (cristal, inclinación 3D, brillo bajo el cursor).
- `demos/<nombre>/index.html`: cada demo es un único archivo autocontenido.
  - `demos/arcade/`: ZAP Arcade (runner, buscaminas, worm; 5 temas, ajustes guardados en localStorage, modo bajo consumo).

## Normas
- Idioma de la interfaz y de los comentarios: español.
- Una demo = una carpeta en `demos/` con su `index.html`; enlázala desde la home con una tarjeta nueva.
- Sin frameworks ni build. Rutas relativas, para que funcione en GitHub Pages bajo `/<repo>/`.
- Respetar `prefers-reduced-motion` y mantener el diseño usable en móvil.
- Probar en local con `python3 -m http.server` desde la raíz.
