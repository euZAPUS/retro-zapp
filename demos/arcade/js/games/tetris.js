/* Zap Blocks · tetris con hold, fantasma, bloqueo con retardo y cuatro modos */
ZAP.register({
  id: 'tetris', name: 'Zap Blocks', tag: 'encaja piezas y limpia líneas', genre: 'Puzzle', color: 'violet', icon: 'tetris',
  modes: [
    { id: 'marathon', name: 'Maratón', desc: 'Sin fin: la velocidad sube cada 10 líneas.' },
    { id: 'sprint', name: 'Sprint 40', desc: 'Limpia 40 líneas lo más rápido que puedas.', metric: { label: 'Tiempo', better: 'low', fmt: v => ZAP.fmtTime(v) } },
    { id: 'ultra', name: 'Contrarreloj', desc: 'Dos minutos para hacer todos los puntos posibles.' },
    { id: 'ghost', name: 'Fantasma', desc: 'Las piezas colocadas se desvanecen. Memoriza el tablero.' }
  ],
  hint: '<kbd>←</kbd> <kbd>→</kbd> mover, <kbd>↓</kbd> bajar, <kbd>↑</kbd> o <kbd>X</kbd> girar, <kbd>Z</kbd> girar al revés, <kbd>Espacio</kbd> caída directa, <kbd>C</kbd> o <kbd>Shift</kbd> guardar pieza. En el móvil usa los botones. Limpiar 4 líneas a la vez es un ZAP.',
  ach: [
    { id: 'tet4', name: '¡ZAP!', desc: 'Limpia 4 líneas a la vez', icon: 'tetris', manual: true },
    { id: 'tet50', name: 'Albañil', desc: '50 líneas en una partida de Maratón', icon: 'crown', test: (p, r) => !!r && r.game === 'tetris' && r.mode === 'marathon' && r.extra && r.extra.lines >= 50 },
    { id: 'tetsprint', name: 'Velocista', desc: 'Sprint 40 en menos de 2 minutos', icon: 'bolt', test: (p, r) => !!r && r.game === 'tetris' && r.mode === 'sprint' && r.value != null && r.value < 120 }
  ],
  create(K) {
    const { ctx, COL, TAU, clamp, rand, mix, rgba, txt, banner, rr, burst, sfx, hud, pad5, addShake, announce, FD, FB, cfg } = K;
    const COLS = 10, ROWS = 20, C = 26, BX = 100, BY = 0, W = 460, H = 520;
    const SHAPES = {
      I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
      O: [[1, 1], [1, 1]],
      T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
      S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
      Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
      J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
      L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]]
    };
    const NAMES = Object.keys(SHAPES);
    const pcol = () => ({ I: COL.cyan, O: COL.amber, T: COL.violet, S: COL.lime, Z: COL.magenta, J: mix(COL.cyan, COL.violet, .6), L: mix(COL.amber, COL.magenta, .55) });
    let PC = pcol();
    const rotCW = m => m[0].map((_, x) => m.map(row => row[x]).reverse());
    const rotCCW = m => m[0].map((_, x) => m.map(row => row[row.length - 1 - x]));

    let mode = 'marathon', board, cur, next, bag, hold, canHold, st, t = 0, score, lines, level, dropT, lockT, lockMoves, clearing, clearT, deadT, newBest, elapsed, timeLeft, combo, b2b, keysDown = {}, das = {}, won, flash = [], tet4 = false;

    function refill() {
      const a = NAMES.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
      bag.push(...a);
    }
    function takeNext() { if (bag.length < 7) refill(); return bag.shift(); }
    function spawn(name) {
      const m = SHAPES[name].map(r => r.slice());
      cur = { n: name, m, x: Math.floor((COLS - m[0].length) / 2), y: name === 'I' ? -1 : 0, rot: 0 };
      lockT = 0; lockMoves = 0; dropT = 0; canHold = true;
      if (collide(cur.m, cur.x, cur.y)) gameOver();
    }
    function nextPiece() { const n = next; next = takeNext(); spawn(n); }
    function reset() {
      board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      bag = []; hold = null; score = 0; lines = 0; level = 0; combo = -1; b2b = false; clearing = null; clearT = 0; deadT = 0; newBest = false; elapsed = 0; timeLeft = 120; won = false; flash = []; tet4 = false;
      st = 'ready'; next = takeNext(); nextPiece(); keysDown = {}; das = {};
      if (mode === 'sprint') level = 2;
    }
    function collide(m, px, py) {
      for (let y = 0; y < m.length; y++) for (let x = 0; x < m[y].length; x++) {
        if (!m[y][x]) continue;
        const bx = px + x, by = py + y;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && board[by][bx]) return true;
      }
      return false;
    }
    function move(dx) {
      if (st !== 'play' || clearing) return false;
      if (!collide(cur.m, cur.x + dx, cur.y)) { cur.x += dx; if (lockT > 0) { lockT = 0; lockMoves++; } sfx.turn(); return true; }
      return false;
    }
    function rotate(dir) {
      if (st === 'ready') st = 'play';
      if (st !== 'play' || clearing || cur.n === 'O') return;
      const m = dir > 0 ? rotCW(cur.m) : rotCCW(cur.m);
      const kicks = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0], [-1, -1], [1, -1]];
      for (const [kx, ky] of kicks) {
        if (!collide(m, cur.x + kx, cur.y + ky)) { cur.m = m; cur.x += kx; cur.y += ky; if (lockT > 0) { lockT = 0; lockMoves++; } sfx.rotate(); return; }
      }
    }
    function softDrop() {
      if (st === 'ready') st = 'play';
      if (st !== 'play' || clearing) return;
      if (!collide(cur.m, cur.x, cur.y + 1)) { cur.y++; score += 1; dropT = 0; lockT = 0; }
    }
    function ghostY() { let y = cur.y; while (!collide(cur.m, cur.x, y + 1)) y++; return y; }
    function hardDrop() {
      if (st === 'ready') st = 'play';
      if (st !== 'play' || clearing) return;
      const gy = ghostY(), d = gy - cur.y;
      score += d * 2;
      for (let y = 0; y < cur.m.length; y++) for (let x = 0; x < cur.m[y].length; x++) if (cur.m[y][x]) {
        burst(BX + (cur.x + x) * C + C / 2, BY + (cur.y + y) * C + C / 2, 2, PC[cur.n], { speed: 60, life: .4, grav: -80, size: 2.5, angle: -Math.PI / 2, spread: .5 });
      }
      cur.y = gy; addShake(3); sfx.drop(); lock();
    }
    function doHold() {
      if (st !== 'play' || clearing || !canHold) return;
      const n = cur.n;
      if (hold) { const h = hold; hold = n; spawn(h); } else { hold = n; nextPiece(); }
      canHold = false; sfx.flip();
    }
    function lock() {
      for (let y = 0; y < cur.m.length; y++) for (let x = 0; x < cur.m[y].length; x++) if (cur.m[y][x]) {
        const by = cur.y + y; if (by < 0) { gameOver(); return; }
        board[by][cur.x + x] = { n: cur.n, age: 0, fade: 1 };
      }
      const full = [];
      for (let y = 0; y < ROWS; y++) if (board[y].every(Boolean)) full.push(y);
      if (full.length) {
        clearing = full; clearT = 0; combo++;
        const base = [0, 100, 300, 500, 800][full.length] * (level + 1);
        const tet = full.length === 4;
        score += base + (tet && b2b ? Math.round(base * .5) : 0) + (combo > 0 ? 50 * combo * (level + 1) : 0);
        b2b = tet;
        sfx.line(full.length);
        if (tet) { addShake(7); K.profile.unlock('tet4'); K.popText(BX + COLS * C / 2, BY + full[0] * C, 'ZAP!', COL.amber, { size: 24 }); } else K.popText(BX + COLS * C / 2, BY + full[0] * C, ['', 'SINGLE', 'DOBLE', 'TRIPLE'][full.length], COL.cyan, { size: 14 });
        full.forEach(y => { for (let x = 0; x < COLS; x++) burst(BX + x * C + C / 2, BY + y * C + C / 2, 2, PC[board[y][x].n], { speed: 200, life: .7, grav: 500, size: 3.5 }); });
      } else { combo = -1; sfx.hit(); nextPiece(); }
      hudSync();
    }
    function finishClear() {
      const n = clearing.length;
      clearing.forEach(() => {});
      board = board.filter((_, y) => !clearing.includes(y));
      while (board.length < ROWS) board.unshift(Array(COLS).fill(null));
      lines += n; clearing = null;
      if (mode === 'marathon' || mode === 'ghost' || mode === 'ultra') level = Math.floor(lines / 10);
      if (mode === 'sprint' && lines >= 40) { finish(true); return; }
      nextPiece(); hudSync();
    }
    function fallTime() { return Math.max(.04, .8 * Math.pow(.84, level)); }
    function gameOver() {
      if (st === 'dead') return;
      st = 'dead'; deadT = 0; addShake(10); sfx.die();
      burst(BX + COLS * C / 2, H / 2, 40, COL.violet, { speed: 320, life: 1, grav: 500, size: 4 });
      if (mode === 'sprint') K.profile.submit(null, { lines });
      else newBest = K.profile.submit(score, { lines, level: level + 1 }).isBest;
      announce('Fin de la partida. ' + score + ' puntos.');
    }
    function finish(win) {
      st = 'dead'; deadT = 0; won = win; sfx.win(); K.confetti(null, null, 70);
      if (mode === 'sprint') newBest = K.profile.submit(+elapsed.toFixed(1), { lines }).isBest;
      else newBest = K.profile.submit(score, { lines, level: level + 1 }).isBest;
    }
    function hudSync() {
      if (mode === 'sprint') { hud.set(0, pad5(score)); hud.set(1, Math.max(0, 40 - lines)); hud.set(2, elapsed.toFixed(1) + ' s'); hud.set(3, K.profile.best() != null ? K.profile.best() + ' s' : '--'); }
      else if (mode === 'ultra') { hud.set(0, pad5(score), true); hud.set(1, pad5(K.profile.best() || 0)); hud.set(2, lines); hud.set(3, Math.max(0, Math.ceil(timeLeft)) + ' s'); }
      else { hud.set(0, pad5(score), true); hud.set(1, pad5(K.profile.best() || 0)); hud.set(2, lines); hud.set(3, level + 1); }
    }

    function update(dt) {
      t += dt;
      if (st === 'play') {
        elapsed += dt;
        if (mode === 'ultra') { timeLeft -= dt; if (timeLeft <= 0) { timeLeft = 0; finish(true); return; } }
        if (clearing) { clearT += dt; if (clearT > .38) finishClear(); }
        else {
          for (const k of ['ArrowLeft', 'ArrowRight']) {
            if (!keysDown[k]) continue;
            das[k] = (das[k] || 0) + dt;
            if (das[k] > .17) { while (das[k] > .17 + .045) { das[k] -= .045; move(k === 'ArrowLeft' ? -1 : 1); } }
          }
          const soft = keysDown.ArrowDown;
          dropT += dt;
          const ft = soft ? Math.min(.045, fallTime()) : fallTime();
          if (dropT >= ft) {
            dropT = 0;
            if (!collide(cur.m, cur.x, cur.y + 1)) { cur.y++; if (soft) score += 1; lockT = 0; }
          }
          if (collide(cur.m, cur.x, cur.y + 1)) { lockT += dt; if (lockT > .5 || lockMoves > 14) { lock(); } } else lockT = 0;
        }
        hudSync();
      }
      if (mode === 'ghost') for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const c = board[y][x]; if (c) { c.age += dt; c.fade = c.age < 1 ? 1 : Math.max(.03, 1 - (c.age - 1) / 1.2); } }
      if (st === 'dead') deadT += dt;
    }

    function cell(px, py, col, a, size) {
      const s = size || C;
      ctx.globalAlpha = a == null ? 1 : a;
      ctx.fillStyle = mix(col, COL.ink, .45); ctx.fillRect(px, py, s, s);
      ctx.fillStyle = col; ctx.fillRect(px + 1, py + 1, s - 2, s - 2);
      ctx.fillStyle = rgba(COL.text, .28); ctx.fillRect(px + 1, py + 1, s - 2, Math.max(2, s * .16)); ctx.fillRect(px + 1, py + 1, Math.max(2, s * .12), s - 2);
      ctx.fillStyle = rgba(COL.ink, .3); ctx.fillRect(px + 1, py + s - Math.max(2, s * .14), s - 2, Math.max(2, s * .14) - 1);
      ctx.globalAlpha = 1;
    }
    function mini(name, cx, cy, size) {
      const m = SHAPES[name], w = m[0].length, h = m.length;
      let minY = 9, maxY = -1, minX = 9, maxX = -1;
      m.forEach((r, y) => r.forEach((v, x) => { if (v) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); minX = Math.min(minX, x); maxX = Math.max(maxX, x); } }));
      const ox = cx - (maxX - minX + 1) * size / 2, oy = cy - (maxY - minY + 1) * size / 2;
      m.forEach((r, y) => r.forEach((v, x) => { if (v) cell(ox + (x - minX) * size, oy + (y - minY) * size, PC[name], 1, size); }));
    }
    function panel(x, y, w, h, title) {
      ctx.fillStyle = rgba(COL.panel, .7); rr(x, y, w, h, 8); ctx.fill();
      ctx.strokeStyle = rgba(COL.text, .14); ctx.lineWidth = 1; ctx.stroke();
      txt(title, x + w / 2, y + 14, { size: 10, color: COL.muted });
    }

    function draw() {
      ctx.fillStyle = COL.ink; ctx.fillRect(-20, -20, W + 40, H + 40);
      // tablero
      ctx.fillStyle = rgba(COL.panel, .55); ctx.fillRect(BX, BY, COLS * C, ROWS * C);
      ctx.fillStyle = rgba(COL.text, .05);
      for (let x = 1; x < COLS; x++) ctx.fillRect(BX + x * C, BY, 1, ROWS * C);
      for (let y = 1; y < ROWS; y++) ctx.fillRect(BX, BY + y * C, COLS * C, 1);
      ctx.strokeStyle = rgba(COL.violet, .6); ctx.lineWidth = 2; ctx.strokeRect(BX - 1, BY - 1, COLS * C + 2, ROWS * C + 2);
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const c = board[y][x]; if (!c) continue;
        if (clearing && clearing.includes(y)) {
          const q = clearT / .38; const wob = Math.sin(q * 30 + x) * 2;
          cell(BX + x * C, BY + y * C + wob, mix(PC[c.n], COL.text, q), 1 - q * .6); continue;
        }
        cell(BX + x * C, BY + y * C, PC[c.n], c.fade);
      }
      if (cur && st !== 'dead') {
        const gy = ghostY();
        for (let y = 0; y < cur.m.length; y++) for (let x = 0; x < cur.m[y].length; x++) if (cur.m[y][x] && !clearing) {
          const py = BY + (gy + y) * C;
          if (gy + y >= 0) { ctx.strokeStyle = rgba(PC[cur.n], .55); ctx.lineWidth = 1.5; ctx.strokeRect(BX + (cur.x + x) * C + 2, py + 2, C - 4, C - 4); }
        }
        if (!clearing) for (let y = 0; y < cur.m.length; y++) for (let x = 0; x < cur.m[y].length; x++) if (cur.m[y][x] && cur.y + y >= 0) {
          const lk = lockT > 0 ? .75 + .25 * Math.sin(t * 40) : 1;
          cell(BX + (cur.x + x) * C, BY + (cur.y + y) * C, PC[cur.n], lk);
        }
      }
      // paneles
      panel(8, 8, 84, 84, 'GUARDAR');
      if (hold) mini(hold, 50, 56, 16);
      panel(BX + COLS * C + 8, 8, 84, 168, 'SIGUIENTE');
      const peek = bag.slice(0, 2); const list = [next].concat(peek);
      list.forEach((n, i) => mini(n, BX + COLS * C + 50, 56 + i * 48, i === 0 ? 17 : 13));
      txt('NIVEL', BX + COLS * C + 50, 232, { size: 10, color: COL.muted }); txt(String(level + 1), BX + COLS * C + 50, 254, { font: FD, size: 22, color: COL.violet });
      txt('LÍNEAS', 50, 232, { size: 10, color: COL.muted }); txt(String(lines), 50, 254, { font: FD, size: 22, color: COL.cyan });
      if (mode === 'ultra') { txt('TIEMPO', 50, 300, { size: 10, color: COL.muted }); txt(String(Math.ceil(timeLeft)), 50, 322, { font: FD, size: 22, color: timeLeft < 15 ? COL.magenta : COL.amber }); }
      if (mode === 'sprint') { txt('FALTAN', 50, 300, { size: 10, color: COL.muted }); txt(String(Math.max(0, 40 - lines)), 50, 322, { font: FD, size: 22, color: COL.amber }); }
      if (combo > 0) txt('COMBO x' + combo, BX + COLS * C + 50, 300, { size: 11, color: COL.amber });
      if (st === 'ready') {
        ctx.fillStyle = rgba(COL.ink, .55); ctx.fillRect(BX, BY, COLS * C, ROWS * C);
        txt('ZAP BLOCKS', BX + COLS * C / 2, H / 2 - 30, { font: FD, size: 24, color: COL.violet });
        txt('Pulsa ↑ o toca girar', BX + COLS * C / 2, H / 2 + 6, { size: 12 });
        txt('para empezar', BX + COLS * C / 2, H / 2 + 24, { size: 12, color: COL.muted });
      }
      if (st === 'dead' && deadT > .4) {
        const good = won || mode === 'ultra';
        const lines2 = mode === 'sprint' ? [won ? elapsed.toFixed(1) + ' s' + (newBest ? ' · nuevo récord' : '') : lines + ' líneas', 'Espacio o toca para reintentar'] : [pad5(score) + ' puntos · ' + lines + ' líneas' + (newBest ? ' · nuevo récord' : ''), 'Espacio o toca para reintentar'];
        ctx.save(); ctx.beginPath(); ctx.rect(BX, 0, COLS * C, H); ctx.clip();
        banner(W, H, mode === 'ultra' ? '¡TIEMPO!' : won ? '¡40 LÍNEAS!' : 'FIN', good ? COL.lime : COL.magenta, lines2); ctx.restore();
      }
    }

    function setMode(id) { mode = ['marathon', 'sprint', 'ultra', 'ghost'].includes(id) ? id : 'marathon'; hud.init(mode === 'sprint' ? ['Puntos', 'Faltan', 'Tiempo', 'Récord'] : mode === 'ultra' ? ['Puntos', 'Récord', 'Líneas', 'Tiempo'] : ['Puntos', 'Récord', 'Líneas', 'Nivel']); reset(); hudSync(); }
    const press = () => { if (st === 'dead') { if (deadT > .5) reset(); return true; } return false; };
    return {
      W, H,
      enter: setMode, setMode,
      leave() { keysDown = {}; },
      blur() { keysDown = {}; },
      recolor() { PC = pcol(); },
      update, draw,
      down(p) { if (press()) return; rotate(1); },
      controls(el) {
        const hl = n => ({ down: () => { keysDown[n] = true; das[n] = 0; move(n === 'ArrowLeft' ? -1 : 1); }, up: () => { keysDown[n] = false; das[n] = 0; } });
        K.pad.buttons(el, [
          Object.assign({ label: '◀', cls: 'sq' }, hl('ArrowLeft')),
          { label: '⟳', cls: 'sq', down: () => { if (!press()) rotate(1); } },
          Object.assign({ label: '▶', cls: 'sq' }, hl('ArrowRight')),
          { label: '▼', cls: 'sq', down: () => { keysDown.ArrowDown = true; softDrop(); }, up: () => { keysDown.ArrowDown = false; } },
          { label: 'CAER', down: () => { if (!press()) hardDrop(); } },
          { label: 'GUARDAR', down: doHold }
        ]);
      },
      key(e, down) {
        const c = e.code;
        if (c === 'ArrowLeft' || c === 'ArrowRight') {
          if (down && !e.repeat) { keysDown[c] = true; das[c] = 0; if (!press()) { if (st === 'ready') st = 'play'; move(c === 'ArrowLeft' ? -1 : 1); } } else if (!down) { keysDown[c] = false; das[c] = 0; }
          return true;
        }
        if (c === 'ArrowDown') { keysDown.ArrowDown = down; if (down && !e.repeat && !press()) softDrop(); return true; }
        if (!down) return c === 'Space' || c === 'ArrowUp' || c === 'KeyX' || c === 'KeyZ' || c === 'KeyC' || c === 'ShiftLeft' || c === 'ShiftRight';
        if (e.repeat) return true;
        if (c === 'ArrowUp' || c === 'KeyX') { if (!press()) rotate(1); return true; }
        if (c === 'KeyZ') { if (!press()) rotate(-1); return true; }
        if (c === 'Space') { if (!press()) hardDrop(); return true; }
        if (c === 'KeyC' || c === 'ShiftLeft' || c === 'ShiftRight') { doHold(); return true; }
        return false;
      },
      state: () => ({ cells: board.flat().filter(Boolean).length, board: board.map(r => r.map(c => (c ? 1 : 0))), lines, score, st, level, mode, clearing: !!clearing, cur: cur && { n: cur.n, m: cur.m.map(r => r.slice()), x: cur.x, y: cur.y } }),
      init() { reset(); }
    };
  }
});
