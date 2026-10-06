/* Worm · snake con seis modos de juego (estilo "modos" del snake de Google) */
ZAP.register({
  id: 'worm', name: 'Worm', tag: 'come paquetes y no te cortes', genre: 'Acción', color: 'lime', icon: 'worm',
  modes: [
    { id: 'classic', name: 'Clásico', desc: 'Los muros matan. El de toda la vida.' },
    { id: 'portal', name: 'Sin muros', desc: 'Atraviesa los bordes: apareces por el lado contrario.' },
    { id: 'maze', name: 'Laberinto', desc: 'Bloques por todo el tablero, distintos en cada partida.' },
    { id: 'poison', name: 'Veneno', desc: 'Aparecen paquetes tóxicos: cada uno te recorta 3 segmentos y 3 puntos.' },
    { id: 'fast', name: 'Rápido', desc: 'Arranca veloz y no deja de acelerar.' },
    { id: 'feast', name: 'Festín', desc: 'Cinco paquetes a la vez. Aprovecha y crece rápido.' }
  ],
  hint: '<kbd>←</kbd> <kbd>↑</kbd> <kbd>↓</kbd> <kbd>→</kbd> o <kbd>WASD</kbd> para girar y <kbd>Espacio</kbd> para pausar. En el móvil, desliza el dedo sobre la pantalla. Los paquetes dorados duran poco y valen cinco puntos.',
  ach: [
    { id: 'worm30', name: 'Serpiente de oro', desc: '30 puntos en Worm', icon: 'worm', test: (p, r) => !!r && r.game === 'worm' && r.value >= 30 },
    { id: 'wormportal', name: 'Sin fronteras', desc: '20 puntos en Sin muros', icon: 'star', test: (p, r) => !!r && r.game === 'worm' && r.mode === 'portal' && r.value >= 20 },
    { id: 'wormpoison', name: 'Inmune', desc: '15 puntos en Veneno', icon: 'skull', test: (p, r) => !!r && r.game === 'worm' && r.mode === 'poison' && r.value >= 15 }
  ],
  create(K) {
    const { ctx, COL, TAU, clamp, rand, randInt, mix, rgba, txt, banner, rr, burst, sfx, hud, pad5, addShake, announce, FD, cfg } = K;
    const N = 20, C = 20, W = N * C, H = N * C;
    const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
    const MODES = {
      classic: { base: .14, min: .06, acc: .0022, foods: 1 },
      portal: { base: .14, min: .06, acc: .0022, foods: 1, wrap: true },
      maze: { base: .15, min: .07, acc: .0020, foods: 1, walls: true },
      poison: { base: .14, min: .065, acc: .0022, foods: 1, poison: true },
      fast: { base: .095, min: .045, acc: .0018, foods: 1 },
      feast: { base: .14, min: .06, acc: .0022, foods: 5 }
    };
    let M = MODES.classic;
    let body, prev, dir, queue, foods, walls, pending, score, st, acc, step, t = 0, deadT, newBest, eatFlash, sw = null, swiped = false, poisonT, apples;

    function isFree(x, y) {
      if (walls[y * N + x]) return false;
      if (body.some(s => s.x === x && s.y === y)) return false;
      return !foods.some(f => f.x === x && f.y === y);
    }
    function freeCell() {
      for (let k = 0; k < 500; k++) {
        const x = randInt(0, N - 1), y = randInt(0, N - 1);
        if (isFree(x, y)) return { x, y };
      }
      return { x: 0, y: 0 };
    }
    function newFood(kind) {
      const f = Object.assign(freeCell(), { kind, born: t });
      if (kind === 'bonus') { f.life = 6; f.max = 6; }
      if (kind === 'poison') { f.life = 12; f.max = 12; }
      return f;
    }
    function genWalls() {
      for (let k = 0; k < 8; k++) {
        const len = randInt(3, 5), horiz = Math.random() < .5;
        const x = randInt(1, N - 2 - (horiz ? len : 0)), y = randInt(1, N - 2 - (horiz ? 0 : len));
        const cells = []; let ok = true;
        for (let i = 0; i < len; i++) {
          const cx = x + (horiz ? i : 0), cy = y + (horiz ? 0 : i);
          if (cy >= 8 && cy <= 12 && cx <= 16) ok = false;
          cells.push([cx, cy]);
        }
        if (ok) cells.forEach(([cx, cy]) => { walls[cy * N + cx] = 1; });
      }
    }
    function reset() {
      body = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
      prev = body.map(s => ({ x: s.x, y: s.y }));
      dir = { x: 1, y: 0 }; queue = []; pending = 0; score = 0; apples = 0; st = 'ready'; acc = 0; step = M.base; deadT = 0; newBest = false; eatFlash = 0;
      walls = new Uint8Array(N * N); foods = []; poisonT = 4;
      if (M.walls) genWalls();
      for (let i = 0; i < M.foods; i++) foods.push(newFood('food'));
    }
    function die(wall) {
      st = 'dead'; deadT = 0; acc = 0;
      addShake(10); sfx.die();
      const head = body[0];
      burst(head.x * C + C / 2 + (wall ? dir.x * 8 : 0), head.y * C + C / 2 + (wall ? dir.y * 8 : 0), 30, COL.lime, { speed: 280, life: .9, grav: 500, size: 4 });
      burst(head.x * C + C / 2, head.y * C + C / 2, 12, COL.magenta, { speed: 200, life: .7, grav: 400, size: 3 });
      newBest = K.profile.submit(score).isBest;
      announce('Conexión perdida. ' + score + ' puntos.');
    }
    function tick() {
      prev = body.map(s => ({ x: s.x, y: s.y }));
      if (queue.length) dir = queue.shift();
      let hx = body[0].x + dir.x, hy = body[0].y + dir.y, wall = false;
      if (M.wrap) { hx = (hx + N) % N; hy = (hy + N) % N; } else if (hx < 0 || hy < 0 || hx >= N || hy >= N) wall = true;
      if (!wall && walls[hy * N + hx]) wall = true;
      const check = pending > 0 ? body : body.slice(0, -1);
      if (wall || check.some(s => s.x === hx && s.y === hy)) { die(wall); return; }
      body.unshift({ x: hx, y: hy });
      const fi = foods.findIndex(f => f.x === hx && f.y === hy);
      if (fi >= 0) {
        const f = foods[fi], px = hx * C + C / 2, py = hy * C + C / 2;
        if (f.kind === 'food') {
          score++; apples++; pending++; eatFlash = 1; sfx.eat();
          burst(px, py, 12, COL.cyan, { speed: 160, life: .5, grav: 100, size: 3 });
          K.popText(px, py - 12, '+1', COL.cyan, { size: 12 });
          foods[fi] = newFood('food');
          if (apples % 5 === 0 && !foods.some(q => q.kind === 'bonus')) foods.push(newFood('bonus'));
        } else if (f.kind === 'bonus') {
          score += 5; pending += 2; eatFlash = 1; sfx.bonus();
          burst(px, py, 22, COL.amber, { speed: 220, life: .7, grav: 150, size: 3.5 });
          K.popText(px, py - 12, '+5', COL.amber);
          foods.splice(fi, 1);
        } else {
          sfx.pop(); addShake(5);
          burst(px, py, 18, COL.magenta, { speed: 220, life: .6, grav: 200, size: 3 });
          K.popText(px, py - 12, '-3', COL.magenta);
          foods.splice(fi, 1);
          if (body.length <= 6) { die(false); return; }
          for (let k = 1; k <= 3; k++) { const s = body[body.length - k]; burst(s.x * C + C / 2, s.y * C + C / 2, 5, COL.violet, { speed: 120, life: .5, grav: 80, size: 3 }); }
          body.splice(body.length - 3, 3);
          score = Math.max(0, score - 3); pending = 0;
        }
      }
      step = Math.max(M.min, M.base - score * M.acc);
      if (pending > 0) { pending--; prev.push({ x: prev[prev.length - 1].x, y: prev[prev.length - 1].y }); } else body.pop();
      if (prev.length > body.length + 1) prev.length = body.length + 1;
    }
    function turn(d) {
      if (st === 'dead') { if (deadT > .4) reset(); else return; }
      if (st === 'paused') return;
      if (st === 'ready') st = 'play';
      const last = queue.length ? queue[queue.length - 1] : dir;
      if ((d.x === last.x && d.y === last.y) || (d.x === -last.x && d.y === -last.y)) return;
      if (queue.length < 2) { queue.push(d); sfx.turn(); }
    }
    function tap() {
      if (st === 'dead') { if (deadT > .4) reset(); }
      else if (st === 'ready') st = 'play';
      else if (st === 'paused') st = 'play';
    }
    function togglePause() { if (st === 'play') st = 'paused'; else if (st === 'paused') st = 'play'; }

    function update(dt) {
      t += dt; eatFlash = Math.max(0, eatFlash - dt * 3);
      if (st === 'play') {
        acc += dt;
        while (acc >= step && st === 'play') { acc -= step; tick(); }
        for (let i = foods.length - 1; i >= 0; i--) { const f = foods[i]; if (f.life != null) { f.life -= dt; if (f.life <= 0) foods.splice(i, 1); } }
        if (M.poison) {
          poisonT -= dt;
          if (poisonT <= 0) { if (foods.filter(f => f.kind === 'poison').length < 3) foods.push(newFood('poison')); poisonT = rand(3, 5); }
        }
      }
      if (st === 'dead') deadT += dt;
      hud.set(0, pad5(score), true); hud.set(1, pad5(K.profile.best() || 0)); hud.set(2, Math.round(.14 / step * 100) + ' %');
    }

    function drawFood(f, glow) {
      const cx = f.x * C + C / 2, cy = f.y * C + C / 2;
      if (f.kind === 'food') {
        const fs = Math.min(1, (t - f.born) * 5), fp = 1 + .12 * Math.sin(t * 6);
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 1.5); ctx.scale(fs * fp, fs * fp);
        if (glow) { ctx.shadowColor = COL.cyan; ctx.shadowBlur = 14; }
        ctx.fillStyle = COL.cyan; ctx.fillRect(-5, -5, 10, 10);
        ctx.shadowBlur = 0; ctx.fillStyle = COL.ink; ctx.fillRect(-2, -2, 4, 4);
        ctx.restore();
      } else if (f.kind === 'bonus') {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(-t * 2); if (glow) { ctx.shadowColor = COL.amber; ctx.shadowBlur = 16; }
        ctx.fillStyle = COL.amber; ctx.fillRect(-6, -6, 12, 12); ctx.rotate(Math.PI / 4); ctx.fillRect(-6, -6, 12, 12);
        ctx.restore();
        ctx.strokeStyle = COL.amber; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 14, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(f.life / f.max, 0, 1)); ctx.stroke();
      } else {
        if (f.life < 3 && Math.floor(t * 8) % 2) return;
        const fs = Math.min(1, (t - f.born) * 5);
        ctx.save(); ctx.translate(cx, cy); ctx.scale(fs, fs); ctx.rotate(Math.sin(t * 5) * .25);
        if (glow) { ctx.shadowColor = COL.magenta; ctx.shadowBlur = 12; }
        ctx.fillStyle = COL.magenta;
        ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = k * TAU / 8, r = k % 2 ? 4.5 : 8; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = COL.ink; ctx.fillRect(-2.5, -2.5, 2, 2); ctx.fillRect(.5, -2.5, 2, 2); ctx.fillRect(-2, 1, 4, 1.5);
        ctx.restore();
      }
    }

    function draw() {
      ctx.fillStyle = COL.ink; ctx.fillRect(-20, -20, W + 40, H + 40);
      const glow = !cfg.low;
      ctx.fillStyle = rgba(COL.cyan, .035);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x + y) % 2 === 0) ctx.fillRect(x * C, y * C, C, C);
      if (M.wrap) {
        ctx.save(); ctx.strokeStyle = rgba(COL.violet, .55 + .2 * Math.sin(t * 3)); ctx.lineWidth = 2; ctx.setLineDash([8, 8]); ctx.lineDashOffset = -t * 24;
        ctx.strokeRect(1, 1, W - 2, H - 2); ctx.restore();
      } else { ctx.strokeStyle = rgba(COL.cyan, .35); ctx.lineWidth = 2; ctx.strokeRect(1, 1, W - 2, H - 2); }
      if (M.walls) {
        for (let i = 0; i < N * N; i++) if (walls[i]) {
          const x = (i % N) * C, y = ((i / N) | 0) * C;
          ctx.fillStyle = mix(COL.magenta, COL.ink, .62); ctx.fillRect(x + 1, y + 1, C - 2, C - 2);
          ctx.fillStyle = rgba(COL.magenta, .85); ctx.fillRect(x + 1, y + 1, C - 2, 2); ctx.fillRect(x + 1, y + 1, 2, C - 2);
          ctx.fillStyle = rgba(COL.ink, .5); ctx.fillRect(x + C / 2, y + 4, 1, C - 8); ctx.fillRect(x + 4, y + C / 2, C - 8, 1);
        }
      }
      for (const f of foods) drawFood(f, glow);
      const a = (st === 'play' || st === 'paused') ? clamp(acc / step, 0, 1) : 1;
      const len = body.length;
      ctx.globalAlpha = st === 'dead' ? (deadT < .6 ? .5 + .5 * Math.sin(deadT * 40) : .4) : 1;
      if (glow && len < 70) { ctx.shadowColor = rgba(COL.lime, .6); ctx.shadowBlur = 10; }
      for (let i = len - 1; i >= 0; i--) {
        const p = prev[i] || body[i], b = body[i];
        const ax = Math.abs(b.x - p.x) > 1 ? 1 : a, ay = Math.abs(b.y - p.y) > 1 ? 1 : a;
        const x = (p.x + (b.x - p.x) * ax) * C, y = (p.y + (b.y - p.y) * ay) * C;
        const sz = Math.max(C - 9, C - 3 - i * .15), off = (C - sz) / 2;
        ctx.fillStyle = mix(COL.lime, COL.ink, (len > 1 ? i / (len - 1) : 0) * .6 + (i === 0 && eatFlash > 0 ? -eatFlash * .5 : 0));
        rr(x + off, y + off, sz, sz, 5); ctx.fill();
        ctx.fillStyle = rgba(COL.text, .24);
        ctx.beginPath(); ctx.arc(x + off + sz * .34, y + off + sz * .32, sz * .14, 0, TAU); ctx.fill();
      }
      ctx.shadowBlur = 0;
      {
        const p = prev[0] || body[0], b = body[0];
        const ax = Math.abs(b.x - p.x) > 1 ? 1 : a, ay = Math.abs(b.y - p.y) > 1 ? 1 : a;
        const hx = (p.x + (b.x - p.x) * ax) * C + C / 2, hy = (p.y + (b.y - p.y) * ay) * C + C / 2;
        const f = dir, sx = -f.y, sy = f.x;
        if (st === 'play' && (t % 1.4) < .3) {
          ctx.strokeStyle = COL.magenta; ctx.lineWidth = 2; ctx.beginPath();
          ctx.moveTo(hx + f.x * 9, hy + f.y * 9); ctx.lineTo(hx + f.x * 15, hy + f.y * 15);
          ctx.moveTo(hx + f.x * 15, hy + f.y * 15); ctx.lineTo(hx + f.x * 18 + sx * 3, hy + f.y * 18 + sy * 3);
          ctx.moveTo(hx + f.x * 15, hy + f.y * 15); ctx.lineTo(hx + f.x * 18 - sx * 3, hy + f.y * 18 - sy * 3);
          ctx.stroke();
        }
        for (const sgn of [-1, 1]) {
          const ex = hx + f.x * 3 + sx * 4 * sgn, ey = hy + f.y * 3 + sy * 4 * sgn;
          ctx.fillStyle = COL.text; ctx.beginPath(); ctx.arc(ex, ey, 2.6, 0, TAU); ctx.fill();
          ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(ex + f.x * 1, ey + f.y * 1, 1.3, 0, TAU); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      if (st === 'ready') {
        ctx.fillStyle = rgba(COL.ink, .5); ctx.fillRect(0, 0, W, H);
        txt('WORM', W / 2, H / 2 - 40, { font: FD, size: 38, color: COL.lime });
        txt('Pulsa una flecha o desliza para empezar', W / 2, H / 2 + 6, { size: 13 });
      }
      if (st === 'paused') banner(W, H, 'PAUSA', COL.cyan, ['Espacio o toca para seguir']);
      if (st === 'dead' && deadT > .5) banner(W, H, 'CONEXIÓN PERDIDA', COL.magenta, [pad5(score) + ' puntos' + (newBest ? ' · nuevo récord' : ''), 'Espacio o una flecha para reiniciar']);
    }

    const KEYS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
    return {
      W, H,
      enter(mode) { hud.init(['Puntos', 'Récord', 'Velocidad']); M = MODES[mode] || MODES.classic; reset(); },
      setMode(mode) { M = MODES[mode] || MODES.classic; reset(); },
      leave() { if (st === 'play') st = 'paused'; sw = null; },
      blur() { if (st === 'play') st = 'paused'; },
      update, draw,
      controls(el) { K.pad.dpad(el, d => turn(DIRS[d])); },
      down(p) { sw = { x: p.x, y: p.y }; swiped = false; },
      move(p) {
        if (!sw) return;
        const dx = p.x - sw.x, dy = p.y - sw.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
        swiped = true;
        turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIRS.right : DIRS.left) : (dy > 0 ? DIRS.down : DIRS.up));
        sw = { x: p.x, y: p.y };
      },
      up() { if (sw && !swiped) tap(); sw = null; },
      key(e, down) {
        const c = e.code;
        if (KEYS[c]) { if (down && !e.repeat) turn(DIRS[KEYS[c]]); return true; }
        if (c === 'Space' || c === 'KeyP') {
          if (down && !e.repeat) { if (st === 'play') togglePause(); else tap(); }
          return true;
        }
        return false;
      },
      init() { reset(); }
    };
  }
});
