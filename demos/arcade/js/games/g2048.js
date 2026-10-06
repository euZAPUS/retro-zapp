/* Zap 2048 · fusiona fichas con animaciones deslizantes, en tableros de 3×3 a 5×5 */
ZAP.register({
  id: '2048', name: 'Zap 2048', tag: 'une fichas iguales hasta llegar a 2048', genre: 'Puzzle', color: 'amber', icon: 'g2048',
  modes: [
    { id: 'n4', name: 'Clásico 4×4', desc: 'El tablero de siempre. Llega a 2048 y sigue.' },
    { id: 'n5', name: 'Grande 5×5', desc: 'Más espacio, más fichas, más puntos.' },
    { id: 'n3', name: 'Mini 3×3', desc: 'Casi imposible llegar a 2048. ¿Cuánto aguantas?' },
    { id: 'timed', name: 'Contrarreloj', desc: '4×4 con 3 minutos en el reloj. Gana el que más puntúe.' }
  ],
  hint: 'Usa las flechas o <kbd>WASD</kbd> (o desliza el dedo) para mover todas las fichas. Dos fichas con el mismo número se fusionan en una. <kbd>R</kbd> reinicia.',
  ach: [
    { id: 'tile2048', name: '¡2048!', desc: 'Forma la ficha 2048', icon: 'g2048', test: (p, r) => !!r && r.game === '2048' && r.extra && r.extra.max >= 2048 },
    { id: 'tile512', name: 'Medio camino', desc: 'Forma una ficha 512', icon: 'star', test: (p, r) => !!r && r.game === '2048' && r.extra && r.extra.max >= 512 }
  ],
  create(K) {
    const { ctx, COL, TAU, clamp, rand, mix, rgba, txt, banner, rr, burst, sfx, hud, pad5, addShake, announce, easeOutBack, easeOutCubic, FD } = K;
    const W = 440, H = 440, PAD = 12, GAP = 10;
    let N = 4, cell = 90, timed = false, board, anim, pops, st, t = 0, score, maxTile, timeLeft, deadT, newBest, won2048, sw = null, swiped = false;
    const px = i => PAD + i * (cell + GAP);
    function ramp(v) {
      const i = Math.round(Math.log2(v));
      const r = [null, mix(COL.panel, COL.text, .16), mix(COL.panel, COL.text, .26), mix(COL.lime, COL.ink, .25), COL.lime, COL.cyan, COL.violet, COL.magenta, COL.amber];
      return r[i] || mix(COL.amber, COL.text, clamp((i - 8) * .2, 0, .6));
    }
    function reset() {
      cell = (W - PAD * 2 - GAP * (N - 1)) / N;
      board = new Array(N * N).fill(0); anim = null; pops = {}; st = 'play'; score = 0; maxTile = 2; timeLeft = 180; deadT = 0; newBest = false; won2048 = false;
      addTile(); addTile(); syncHud();
    }
    function addTile() {
      const empty = []; for (let i = 0; i < N * N; i++) if (!board[i]) empty.push(i);
      if (!empty.length) return;
      const i = empty[(Math.random() * empty.length) | 0];
      board[i] = Math.random() < .9 ? 2 : 4; pops[i] = { t0: t, kind: 'new' };
    }
    function canMove() {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const v = board[y * N + x]; if (!v) return true;
        if (x + 1 < N && board[y * N + x + 1] === v) return true;
        if (y + 1 < N && board[(y + 1) * N + x] === v) return true;
      }
      return false;
    }
    function finishAnim() {
      if (!anim) return;
      board = anim.next; anim = null;
      for (const m of pops._pending || []) pops[m] = { t0: t, kind: 'merge' };
      pops._pending = null;
      addTile();
      if (!canMove()) gameOver();
    }
    function slide(dx, dy) {
      if (st !== 'play') return;
      finishAnim(); if (st !== 'play') return;
      const moves = [], next = new Array(N * N).fill(0), merged = []; let gained = 0, moved = false;
      for (let line = 0; line < N; line++) {
        // coordenadas de la línea ordenadas desde el borde hacia el que se mueve
        const cells = [];
        for (let k = 0; k < N; k++) {
          const x = dx === 0 ? line : dx > 0 ? N - 1 - k : k, y = dy === 0 ? line : dy > 0 ? N - 1 - k : k;
          cells.push([x, y]);
        }
        let slot = 0, last = null;
        for (const [x, y] of cells) {
          const v = board[y * N + x]; if (!v) continue;
          let target;
          if (last && last.v === v && !last.m) {
            target = cells[slot - 1]; last.m = true; next[target[1] * N + target[0]] = v * 2;
            gained += v * 2; merged.push(target[1] * N + target[0]); if (v * 2 > maxTile) maxTile = v * 2;
          } else {
            target = cells[slot]; next[target[1] * N + target[0]] = v; last = { v, m: false }; slot++;
          }
          if (target[0] !== x || target[1] !== y) moved = true;
          moves.push({ v, fx: x, fy: y, tx: target[0], ty: target[1] });
        }
      }
      if (!moved) return;
      score += gained; anim = { t: 0, dur: .11, moves, next };
      pops._pending = merged;
      if (gained) { sfx.brick(Math.min(10, Math.round(Math.log2(gained)))); K.popText(W / 2, 22, '+' + gained, COL.amber, { size: 16 }); }
      else sfx.swish();
      if (maxTile >= 2048 && !won2048) { won2048 = true; K.confetti(null, null, 120); sfx.win(); K.popText(W / 2, H / 2, '¡2048!', COL.lime, { size: 34, life: 1.6 }); }
      syncHud();
    }
    function gameOver() {
      st = 'dead'; deadT = 0; addShake(6); sfx.die();
      newBest = K.profile.submit(score, { max: maxTile }).isBest;
      announce('Fin de la partida. ' + score + ' puntos.');
    }
    function syncHud() { hud.set(0, pad5(score), true); hud.set(1, pad5(K.profile.best() || 0)); hud.set(2, maxTile); if (timed) hud.set(3, Math.max(0, Math.ceil(timeLeft)) + ' s'); }

    function update(dt) {
      t += dt;
      if (anim) { anim.t += dt; if (anim.t >= anim.dur) finishAnim(); }
      if (timed && st === 'play') { timeLeft -= dt; if (timeLeft <= 0) { timeLeft = 0; finishAnim(); if (st === 'play') gameOver(); } syncHud(); }
      if (st === 'dead') deadT += dt;
    }

    function tile(x, y, v, s, a) {
      const c = ramp(v), size = cell * s;
      ctx.save(); ctx.translate(x + cell / 2, y + cell / 2); ctx.globalAlpha = a == null ? 1 : a;
      if (v >= 128 && !K.cfg.low) { ctx.shadowColor = c; ctx.shadowBlur = 8 + Math.log2(v); }
      ctx.fillStyle = c; rr(-size / 2, -size / 2, size, size, 10); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = rgba(COL.text, .16); rr(-size / 2 + 3, -size / 2 + 3, size - 6, size * .28, 8); ctx.fill();
      const dark = Math.log2(v) <= 2;
      const len = String(v).length, fs = cell * (len <= 2 ? .42 : len === 3 ? .35 : .28) * s;
      txt(String(v), 0, 2, { font: FD, size: fs, color: dark ? COL.text : COL.ink });
      ctx.restore();
    }
    function draw() {
      ctx.fillStyle = COL.ink; ctx.fillRect(-20, -20, W + 40, H + 40);
      ctx.fillStyle = rgba(COL.panel, .8); rr(0, 0, W, H, 16); ctx.fill();
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { ctx.fillStyle = rgba(COL.text, .06); rr(px(x), px(y), cell, cell, 10); ctx.fill(); }
      if (anim) {
        const q = easeOutCubic(clamp(anim.t / anim.dur, 0, 1));
        for (const m of anim.moves) tile(px(m.fx + (m.tx - m.fx) * q), px(m.fy + (m.ty - m.fy) * q), m.v, 1);
      } else {
        for (let i = 0; i < N * N; i++) {
          const v = board[i]; if (!v) continue;
          const p = pops[i]; let s = 1;
          if (p) {
            const q = (t - p.t0) / (p.kind === 'new' ? .16 : .2);
            if (q >= 1) delete pops[i]; else s = p.kind === 'new' ? easeOutBack(clamp(q, 0, 1)) : 1 + .2 * Math.sin(q * Math.PI);
          }
          tile(px(i % N), px((i / N) | 0), v, Math.max(.01, s));
        }
      }
      if (st === 'dead' && deadT > .3) banner(W, H, timed && timeLeft <= 0 ? '¡TIEMPO!' : 'SIN MOVIMIENTOS', timed && timeLeft <= 0 ? COL.lime : COL.magenta, [pad5(score) + ' puntos · ficha ' + maxTile + (newBest ? ' · nuevo récord' : ''), 'Pulsa R o toca para reiniciar']);
    }

    const DIR = { ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1] };
    function setMode(id) {
      timed = id === 'timed'; N = id === 'n5' ? 5 : id === 'n3' ? 3 : 4;
      hud.init(timed ? ['Puntos', 'Récord', 'Mejor ficha', 'Tiempo'] : ['Puntos', 'Récord', 'Mejor ficha']);
      reset();
    }
    return {
      W, H,
      enter: setMode, setMode,
      update, draw,
      controls(el) { K.pad.dpad(el, d => slide(...{ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d])); },
      down(p) { sw = { x: p.x, y: p.y }; swiped = false; },
      move(p) {
        if (!sw) return;
        const dx = p.x - sw.x, dy = p.y - sw.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
        swiped = true;
        if (Math.abs(dx) > Math.abs(dy)) slide(dx > 0 ? 1 : -1, 0); else slide(0, dy > 0 ? 1 : -1);
        sw = null;
      },
      up() { if (sw && !swiped && st === 'dead' && deadT > .5) reset(); sw = null; },
      key(e, down) {
        if (!down) return !!DIR[e.code];
        if (DIR[e.code]) { if (!e.repeat) slide(...DIR[e.code]); return true; }
        if (e.code === 'KeyR') { reset(); return true; }
        return false;
      },
      state: () => ({ N, board: board.slice(), score, st, anim: !!anim }),
      init() { reset(); }
    };
  }
});
