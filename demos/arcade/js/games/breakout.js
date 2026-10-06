/* Brick Breaker · rompeladrillos con potenciadores, combos y niveles */
ZAP.register({
  id: 'breakout', name: 'Brick Breaker', tag: 'rompe los ladrillos con una bola', genre: 'Reflejos', color: 'amber', icon: 'breakout',
  modes: [
    { id: 'classic', name: 'Clásico', desc: '3 vidas, un solo balón y potenciadores ocasionales.' },
    { id: 'multi', name: 'Multibola', desc: 'Empiezas con dos bolas y llueven potenciadores.' },
    { id: 'hardcore', name: 'Hardcore', desc: 'Una sola vida y bola mucho más rápida.' }
  ],
  hint: 'Mueve el ratón o el dedo (también <kbd>←</kbd> <kbd>→</kbd> o <kbd>A</kbd> <kbd>D</kbd>) para mover la pala. <kbd>Espacio</kbd> o toca para lanzar. Cápsulas: <b>W</b> pala ancha, <b>M</b> multibola, <b>S</b> cámara lenta, <b>♥</b> vida extra. Encadena ladrillos sin tocar la pala para subir el combo.',
  ach: [
    { id: 'brk3', name: 'Demoledor', desc: 'Llega al nivel 3 en Brick Breaker', icon: 'breakout', test: (p, r) => !!r && r.game === 'breakout' && r.extra && r.extra.level >= 3 },
    { id: 'brkhard', name: 'Sin red', desc: '1000 puntos en Hardcore', icon: 'skull', test: (p, r) => !!r && r.game === 'breakout' && r.mode === 'hardcore' && r.value >= 1000 }
  ],
  create(K) {
    const { ctx, COL, TAU, clamp, rand, randInt, mix, rgba, txt, banner, rr, burst, sfx, hud, pad5, addShake, announce, FD, cfg } = K;
    const W = 420, H = 540, PY = H - 44, PH = 12, BR = 6, COLS = 10, BW = 40, BH = 17, TOP = 58;
    const MODES = {
      classic: { lives: 3, balls: 1, speed: 310, drop: .13 },
      multi: { lives: 3, balls: 2, speed: 310, drop: .24 },
      hardcore: { lives: 1, balls: 1, speed: 390, drop: .08 }
    };
    let M = MODES.classic;
    let st, t = 0, balls, bricks, caps, paddle, lives, level, score, combo, wideT, slowT, alive, clearT, deadT, newBest, keys = { l: false, r: false };
    const stars = Array.from({ length: 36 }, () => ({ x: rand(0, W), y: rand(0, H), s: rand(.3, 1), p: rand(0, TAU) }));
    const rowCol = () => [COL.magenta, COL.amber, COL.lime, COL.cyan, COL.violet, mix(COL.magenta, COL.amber, .5), mix(COL.lime, COL.cyan, .5), mix(COL.violet, COL.magenta, .5)];

    function layout() {
      const rows = Math.min(8, 4 + level), pat = level % 5, cols = rowCol();
      bricks = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) {
        let on = true;
        if (pat === 1) on = (r + c) % 2 === 0;
        else if (pat === 2) on = c >= r && c < COLS - r;
        else if (pat === 3) on = r % 2 === 0 || c % 3 === 0;
        else if (pat === 4) on = r === 0 || r === rows - 1 || c === 0 || c === COLS - 1 || (c + r) % 4 === 0;
        if (!on) continue;
        const hp = level >= 3 && r < 3 ? 3 : level >= 1 && r < 2 ? 2 : 1;
        bricks.push({ x: 10 + c * BW, y: TOP + r * (BH + 3), w: BW - 2, h: BH, hp, max: hp, col: cols[r % cols.length], flash: 0, alive: true });
      }
      alive = bricks.length;
    }
    const target = () => (M.speed + level * 20 > 560 ? 560 : M.speed + level * 20) * (slowT > 0 ? .68 : 1);
    function stickBalls(n) {
      balls = [];
      for (let i = 0; i < n; i++) balls.push({ x: paddle.x + (i - (n - 1) / 2) * 14, y: PY - BR - 1, vx: 0, vy: 0, stuck: true, off: (i - (n - 1) / 2) * 14, trail: [] });
    }
    function reset() {
      st = 'ready'; level = 0; score = 0; combo = 0; lives = M.lives; wideT = 0; slowT = 0; caps = []; clearT = 0; deadT = 0; newBest = false;
      paddle = { x: W / 2, tx: W / 2, w: 78, hit: 0 };
      layout(); stickBalls(M.balls); syncHud(true);
    }
    function syncHud(force) {
      hud.set(0, pad5(score), true); hud.set(1, pad5(K.profile.best() || 0)); hud.set(2, '♥'.repeat(Math.max(0, lives))); hud.set(3, level + 1);
      if (force) hud.bump(2);
    }
    function launch() {
      if (st === 'dead') { if (deadT > .5) reset(); return; }
      if (st === 'cleared') return;
      let any = false;
      for (const b of balls) if (b.stuck) {
        const a = -Math.PI / 2 + rand(-.3, .3), s = target();
        b.vx = Math.cos(a) * s; b.vy = Math.sin(a) * s; b.stuck = false; any = true;
      }
      if (any) { st = 'play'; sfx.bounce(440); }
    }
    function spawnCap(x, y) {
      const r = Math.random();
      const kind = M === MODES.multi ? (r < .4 ? 'multi' : r < .65 ? 'wide' : r < .9 ? 'slow' : 'life') : (r < .3 ? 'wide' : r < .55 ? 'multi' : r < .85 ? 'slow' : 'life');
      caps.push({ x, y, kind });
    }
    function hitBrick(b, bl) {
      b.hp--; b.flash = 1;
      if (b.hp > 0) { sfx.brick(2); burst(bl.x, bl.y, 4, b.col, { speed: 120, life: .3, grav: 200, size: 2.5 }); return; }
      b.alive = false; alive--; combo++;
      const pts = 10 + Math.min(combo, 10) * 2;
      score += pts;
      sfx.brick(Math.min(combo, 10));
      burst(b.x + b.w / 2, b.y + b.h / 2, 12, b.col, { speed: 220, life: .6, grav: 400, size: 3.5 });
      if (combo >= 3 && combo % 3 === 0) K.popText(b.x + b.w / 2, b.y, 'x' + combo, COL.amber, { size: 13 });
      if (Math.random() < M.drop) spawnCap(b.x + b.w / 2, b.y + b.h / 2);
      syncHud();
      if (alive <= 0) { st = 'cleared'; clearT = 0; sfx.win(); K.confetti(null, null, 60); }
    }
    function stepBall(b, h) {
      b.x += b.vx * h; b.y += b.vy * h;
      if (b.x < BR) { b.x = BR; b.vx = Math.abs(b.vx); sfx.bounce(280); }
      else if (b.x > W - BR) { b.x = W - BR; b.vx = -Math.abs(b.vx); sfx.bounce(280); }
      if (b.y < BR) { b.y = BR; b.vy = Math.abs(b.vy); sfx.bounce(300); }
      if (b.vy > 0 && b.y + BR >= PY && b.y - BR <= PY + PH && b.x >= paddle.x - paddle.w / 2 - BR && b.x <= paddle.x + paddle.w / 2 + BR) {
        const off = clamp((b.x - paddle.x) / (paddle.w / 2), -1, 1), a = off * 1.12, s = Math.max(target(), Math.hypot(b.vx, b.vy) * .98);
        b.vx = Math.sin(a) * s; b.vy = -Math.cos(a) * s; b.y = PY - BR; paddle.hit = 1; combo = 0;
        sfx.bounce(380);
        burst(b.x, PY, 5, COL.cyan, { speed: 120, life: .3, grav: 150, size: 2.5, angle: -Math.PI / 2, spread: 1.6 });
      }
      for (const k of bricks) {
        if (!k.alive) continue;
        const cx = clamp(b.x, k.x, k.x + k.w), cy = clamp(b.y, k.y, k.y + k.h), dx = b.x - cx, dy = b.y - cy;
        if (dx * dx + dy * dy > BR * BR) continue;
        const ox = (k.w / 2 + BR) - Math.abs(b.x - (k.x + k.w / 2)), oy = (k.h / 2 + BR) - Math.abs(b.y - (k.y + k.h / 2));
        if (ox < oy) { b.vx = (b.x < k.x + k.w / 2 ? -1 : 1) * Math.abs(b.vx); b.x += (b.x < k.x + k.w / 2 ? -ox : ox) * .5; }
        else { b.vy = (b.y < k.y + k.h / 2 ? -1 : 1) * Math.abs(b.vy); b.y += (b.y < k.y + k.h / 2 ? -oy : oy) * .5; }
        hitBrick(k, b);
        break;
      }
    }
    function loseBall() {
      combo = 0; lives--; addShake(9); sfx.miss(); syncHud(true);
      burst(paddle.x, PY, 24, COL.magenta, { speed: 260, life: .8, grav: 500, size: 3.5 });
      if (lives <= 0) {
        st = 'dead'; deadT = 0;
        newBest = K.profile.submit(score, { level: level + 1 }).isBest;
        announce('Fin de la partida. ' + score + ' puntos.');
      } else { st = 'ready'; caps = []; stickBalls(M === MODES.multi ? 2 : 1); }
    }

    function update(dt) {
      t += dt;
      paddle.hit = Math.max(0, paddle.hit - dt * 5);
      const dir = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
      if (dir) paddle.tx = clamp(paddle.tx + dir * 560 * dt, paddle.w / 2, W - paddle.w / 2);
      const w = wideT > 0 ? 124 : 78; paddle.w += (w - paddle.w) * Math.min(1, dt * 10);
      paddle.x += (paddle.tx - paddle.x) * Math.min(1, dt * 22);
      paddle.x = clamp(paddle.x, paddle.w / 2, W - paddle.w / 2);
      wideT = Math.max(0, wideT - dt); slowT = Math.max(0, slowT - dt);
      for (const b of bricks) b.flash = Math.max(0, b.flash - dt * 4);
      if (st === 'play') {
        for (let i = balls.length - 1; i >= 0; i--) {
          const b = balls[i];
          if (b.stuck) { b.x = paddle.x + b.off; continue; }
          const sp = Math.hypot(b.vx, b.vy) || 1, tg = target(), k = 1 + (tg / sp - 1) * Math.min(1, dt * 4);
          b.vx *= k; b.vy *= k;
          if (Math.abs(b.vy) < tg * .22) b.vy = (b.vy < 0 ? -1 : 1) * tg * .22;
          const n = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 4)), h = dt / n;
          for (let s = 0; s < n && st === 'play'; s++) stepBall(b, h);
          b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 9) b.trail.shift();
          if (b.y > H + BR * 2) balls.splice(i, 1);
        }
        if (st === 'play' && balls.length === 0) loseBall();
        for (let i = caps.length - 1; i >= 0; i--) {
          const c = caps[i]; c.y += 130 * dt;
          if (c.y > PY - 4 && c.y < PY + PH + 10 && Math.abs(c.x - paddle.x) < paddle.w / 2 + 12) {
            caps.splice(i, 1); sfx.bonus();
            if (c.kind === 'wide') wideT = 12;
            else if (c.kind === 'slow') slowT = 8;
            else if (c.kind === 'life') { lives = Math.min(5, lives + 1); K.popText(paddle.x, PY - 24, '+1 ♥', COL.magenta); syncHud(true); }
            else if (c.kind === 'multi') {
              const src = balls.find(q => !q.stuck) || balls[0];
              if (src) for (const da of [-.45, .45]) {
                const a = Math.atan2(src.vy, src.vx) + da, s = Math.hypot(src.vx, src.vy) || target();
                balls.push({ x: src.x, y: src.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, stuck: false, off: 0, trail: [] });
              }
            }
            burst(c.x, PY, 14, COL.amber, { speed: 200, life: .5, grav: 200, size: 3 });
          } else if (c.y > H + 20) caps.splice(i, 1);
        }
      } else if (st === 'ready') {
        for (const b of balls) b.x = paddle.x + b.off;
      } else if (st === 'cleared') {
        clearT += dt;
        if (clearT > 1.5) { level++; layout(); caps = []; stickBalls(M === MODES.multi ? 2 : 1); st = 'ready'; syncHud(); }
      } else if (st === 'dead') deadT += dt;
    }

    function drawBrick(b) {
      const f = b.flash, c = f > 0 ? mix(b.col, COL.text, f * .7) : b.col;
      ctx.fillStyle = mix(c, COL.ink, .55 - (b.hp - 1) * .12 * 0); ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = c; ctx.fillRect(b.x, b.y, b.w, 3);
      ctx.fillStyle = rgba(COL.text, .16); ctx.fillRect(b.x, b.y + 3, b.w, 3);
      ctx.fillStyle = rgba(COL.ink, .35); ctx.fillRect(b.x, b.y + b.h - 2, b.w, 2);
      if (b.max > 1) { ctx.strokeStyle = rgba(COL.text, .55); ctx.lineWidth = 1; ctx.strokeRect(b.x + .5, b.y + .5, b.w - 1, b.h - 1); for (let i = 0; i < b.hp; i++) { ctx.fillStyle = COL.text; ctx.fillRect(b.x + 5 + i * 6, b.y + b.h - 7, 4, 3); } }
    }
    function draw() {
      ctx.fillStyle = COL.ink; ctx.fillRect(-20, -20, W + 40, H + 40);
      for (const s of stars) { ctx.globalAlpha = .12 + .2 * Math.sin(t * s.s * 2 + s.p); ctx.fillStyle = COL.text; ctx.fillRect(s.x, (s.y + t * 6 * s.s) % H, 2, 2); }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = rgba(COL.cyan, .25); ctx.lineWidth = 2; ctx.strokeRect(1, 1, W - 2, H - 2);
      if (slowT > 0) { ctx.fillStyle = rgba(COL.violet, .07 + .03 * Math.sin(t * 6)); ctx.fillRect(0, 0, W, H); }
      for (const b of bricks) if (b.alive) drawBrick(b);
      for (const c of caps) {
        const col = c.kind === 'wide' ? COL.cyan : c.kind === 'multi' ? COL.amber : c.kind === 'slow' ? COL.violet : COL.magenta;
        ctx.save(); ctx.translate(c.x, c.y);
        if (!cfg.low) { ctx.shadowColor = col; ctx.shadowBlur = 12; }
        ctx.fillStyle = col; rr(-13, -8, 26, 16, 6); ctx.fill(); ctx.shadowBlur = 0;
        ctx.restore();
        txt(c.kind === 'wide' ? 'W' : c.kind === 'multi' ? 'M' : c.kind === 'slow' ? 'S' : '♥', c.x, c.y + 1, { font: FD, size: 11, color: COL.ink });
      }
      // pala
      const sq = 1 + paddle.hit * .25;
      ctx.save(); ctx.translate(paddle.x, PY + PH / 2); ctx.scale(1, 1 / sq);
      if (!cfg.low) { ctx.shadowColor = COL.cyan; ctx.shadowBlur = 16; }
      ctx.fillStyle = COL.cyan; rr(-paddle.w / 2, -PH / 2, paddle.w, PH, 6); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = rgba(COL.text, .35); rr(-paddle.w / 2 + 4, -PH / 2 + 2, paddle.w - 8, 3, 2); ctx.fill();
      ctx.restore();
      for (const b of balls) {
        for (let i = 0; i < b.trail.length; i++) { const q = b.trail[i]; ctx.globalAlpha = i / b.trail.length * .35; ctx.fillStyle = COL.amber; ctx.beginPath(); ctx.arc(q.x, q.y, BR * (.4 + i / b.trail.length * .6), 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
        if (!cfg.low) { ctx.shadowColor = COL.amber; ctx.shadowBlur = 14; }
        ctx.fillStyle = COL.text; ctx.beginPath(); ctx.arc(b.x, b.y, BR, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
      }
      if (combo >= 3) txt('COMBO x' + combo, W / 2, H - 14, { font: FD, size: 12, color: COL.amber, alpha: .8 });
      if (st === 'ready') {
        txt(level === 0 && score === 0 ? 'BRICK BREAKER' : 'NIVEL ' + (level + 1), W / 2, H * .6, { font: FD, size: 28, color: COL.amber });
        txt('Toca o pulsa Espacio para lanzar', W / 2, H * .6 + 34, { size: 13 });
      }
      if (st === 'cleared') { const q = clearT / 1.5; txt('¡NIVEL SUPERADO!', W / 2, H * .55, { font: FD, size: 26, color: COL.lime, alpha: 1 - Math.max(0, q - .7) / .3 }); }
      if (st === 'dead' && deadT > .3) banner(W, H, 'FIN DE LA PARTIDA', COL.magenta, [pad5(score) + ' puntos · nivel ' + (level + 1) + (newBest ? ' · nuevo récord' : ''), 'Toca o Espacio para reiniciar']);
    }

    function setMode(id) { M = MODES[id] || MODES.classic; reset(); }
    return {
      W, H,
      enter(id) { hud.init(['Puntos', 'Récord', 'Vidas', 'Nivel']); setMode(id); },
      setMode,
      leave() { keys.l = keys.r = false; },
      blur() { keys.l = keys.r = false; },
      update, draw,
      down(p) { paddle.tx = clamp(p.x, paddle.w / 2, W - paddle.w / 2); launch(); },
      move(p) { paddle.tx = clamp(p.x, paddle.w / 2, W - paddle.w / 2); },
      up() {},
      controls(el) {
        K.pad.buttons(el, [
          { label: '◀', cls: 'sq', down: () => { keys.l = true; }, up: () => { keys.l = false; } },
          { label: 'LANZAR', down: launch },
          { label: '▶', cls: 'sq', down: () => { keys.r = true; }, up: () => { keys.r = false; } }
        ]);
      },
      key(e, down) {
        const c = e.code;
        if (c === 'ArrowLeft' || c === 'KeyA') { keys.l = down; return true; }
        if (c === 'ArrowRight' || c === 'KeyD') { keys.r = down; return true; }
        if (c === 'Space' || c === 'ArrowUp') { if (down && !e.repeat) launch(); return true; }
        return false;
      },
      state: () => ({ balls: balls.map(b => ({ x: b.x, y: b.y, stuck: b.stuck })), alive, score, lives, level, st, px: paddle.x }),
      init() { reset(); }
    };
  }
});
