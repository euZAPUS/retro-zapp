# retro-zapp

Portfolio de demos interactivas, sin build ni dependencias.

- [ZAP Arcade](demos/arcade/): 13 minijuegos con modos de juego, perfil con récords y logros, 9 temas, fondos, marcos de pantalla y animaciones.
  Juegos: Glitch Runner, Zero-Day Sweeper, Worm, Brick Breaker, Neon Pong, Zap Blocks, Zap 2048, Floppy Byte, Memory Match, Simon Zap, Zap Invaders, Bug Smasher y Cuatro en Línea.

Publicable tal cual con GitHub Pages (Settings → Pages → rama `main`, carpeta raíz).

## App de escritorio (con actualizaciones automáticas)

1. Entra en **Releases** del repositorio y descarga el instalador de tu sistema (`ZAP Arcade Setup X.Y.Z.exe` en Windows).
2. Instálalo (un clic, sin permisos de administrador) y ábrelo desde el escritorio.
3. Cuando haya una versión nueva aparece un punto verde en **Ajustes**. Dentro, pulsa **Actualizar y reiniciar**: descarga, se reinicia sola y abre la versión nueva.

Cada cambio que se une a `main` publica una versión nueva sola (workflow `Publicar app de escritorio`). También se puede lanzar a mano desde la pestaña *Actions*.
Para desarrollar: `cd desktop && npm install && npm start`.
