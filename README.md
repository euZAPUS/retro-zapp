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

## Sincronizar tu perfil entre dos PCs

Tus récords, logros, nivel, avatar y aspecto (tema, fondo, estilos) pueden ser los mismos en todos tus equipos. Se guardan en un **Gist secreto** de tu cuenta de GitHub.

1. En GitHub: [crea un token clásico](https://github.com/settings/tokens/new?scopes=gist&description=ZAP%20Arcade%20sync) con **solo** el permiso `gist` (marca una caducidad que te venga bien).
2. En la app: **Ajustes → Sincronización entre equipos**, pega el token y pulsa **Conectar con GitHub**.
3. En el otro PC repite lo mismo **con el mismo token** (o crea otro token de la misma cuenta).

Cómo funciona: lo que juegas en cada equipo **se suma** (no se pisa) y los récords se quedan con el mejor. Se sincroniza al abrir, 10 s después de cada partida y cada 10 min, o con el botón *Sincronizar ahora*.

- El token solo da acceso a tus Gists. En la app de escritorio se guarda cifrado con el sistema (en Windows, DPAPI); en el navegador se guarda sin cifrar y se avisa. Puedes revocarlo cuando quieras en <https://github.com/settings/tokens>.
- Un Gist secreto no aparece en listados, pero cualquiera que tenga su URL puede leerlo: no contiene nada sensible (solo récords y ajustes).
- «Reiniciar progreso» en un PC se deshace al sincronizar (vuelve a bajar lo guardado). Para empezar de cero, desconecta, borra el Gist `zap-arcade-profile.json` en gist.github.com y reinicia.

## Licencia

© 2026 euZAPUS. **Todos los derechos reservados.** Puedes ver el código y jugar para uso personal; copiarlo, modificarlo, redistribuirlo o usarlo comercialmente requiere permiso por escrito. Ver [`LICENSE`](LICENSE). Los componentes de terceros y sus licencias están en [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
