/* Pong · contra la IA (tres niveles) o contra la pared (Frontón) */
ZAP.register({
  id: 'pong', name: 'Neon Pong', tag: 'duelo clásico contra la IA o la pared', genre: 'Versus', color: 'cyan', icon: 'pong',
  metric: { label: 'Racha de victorias', better: 'high', fmt: v => v + (v === 1 ? ' victoria' : ' victorias') },
  modes: [
    { id: 'rally', name: 'Frontón', desc: 'Tú contra la pared: cada golpe suma y la bola acelera.', metric: { label: 'Golpes', better: 'high', fmt: v => v + ' golpes' } },
    { id: 'easy', name: 'IA fácil', desc: 'Primero en llegar a 5 puntos. La IA es lenta y despistada.' },
    { id: 'normal', name: 'IA normal', desc: 'Primero a 5. Rival decente.' },
    { id: 'hard', name: 'IA experta', desc: 'Primero a 5. Casi no falla: usa los efectos de la pala.' }
  ],
  skins: [{ id: 'neon', name: 'Neón', lvl: 0 }, { id: 'retro', name: 'Retro', lvl: 2 }, { id: 'plasma', name: 'Plasma', lvl: 4 }],
  hint: 'Mueve el ratón o el dedo arriba y abajo, o usa <kbd>W</kbd> <kbd>S</kbd> / <kbd>↑</kbd> <kbd>↓</kbd>. Golpea la bola con los bordes de la pala para darle más ángulo. <kbd>Espacio</kbd> o toca para sacar.',
  ach: [
    { id: 'pong20', name: 'Muro de frontón', desc: '20 golpes seguidos en Frontón', icon: 'pong', test: (p, r) => !!r && r.game === 'pong' && r.mode === 'rally' && r.value >= 20 },
    { id: 'pongwin', name: 'Humillación', desc: 'Gana a la IA experta', icon: 'crown', test: (p, r) => !!r && r.game === 'pong' && r.mode === 'hard' && r.value >= 1 }
  ],
  create(K) {
    const { ctx, COL, TAU, clamp, rand, mix, rgba, txt, banner, rr, burst, sfx, hud, pad5, addShake, announce, FD, cfg } = K;
    const W = 600, H = 380, PW = 12, PHT = 72, BR = 7, PXL = 26, PXR = W - 26 - PW, WALL = W - 10;
    const AI = { easy: { sp: 210, err: 56, react: .35 }, normal: { sp: 310, err: 26, react: .2 }, hard: { sp: 440, err: 8, react: .08 } };
    const streaks = {};
    let skin = 'neon';
    let mode = 'normal', rally = false, st, t = 0, ball, you, foe, py, pty, pv, ay, ayT, serveT, serveDir, hits, deadT, newBest, endWin, keys = { u: false, d: false }, errOff = 0, flashL = 0, flashR = 0, thinkT = 0;

    function hudFor() { hud.init(rally ? ['Golpes', 'Récord'] : ['Tú', 'IA', 'Racha', 'Récord']); }
    function reset() {
      st = 'ready'; you = 0; foe = 0; hits = 0; py = H / 2; pty = H / 2; pv = 0; ay = H / 2; ayT = H / 2; deadT = 0; newBest = false; serveDir = 1; serveT = 0; errOff = 0;
      ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, sp: 300, trail: [] }; flashL = flashR = 0;
    }
    function serve() {
      const a = rand(-.5, .5);
      ball.sp = rally ? 300 : 320; ball.x = W / 2; ball.y = H / 2 + rand(-60, 60); ball.trail = [];
      /* en Frontón la bola sale siempre hacia la pared (derecha) */
      ball.vx = Math.cos(a) * ball.sp * (rally ? 1 : serveDir); ball.vy = Math.sin(a) * ball.sp;
      st = 'play';
    }
    function start() {
      if (st === 'dead') { if (deadT > .5) reset(); return; }
      if (st === 'ready') { st = 'serve'; serveT = 1.1; }
    }
    function predict() {
      if (ball.vx <= 0) return H / 2;
      const tt = (PXR - ball.x) / ball.vx; let y = ball.y + ball.vy * tt;
      const span = H - BR * 2; y = (y - BR) % (span * 2); if (y < 0) y += span * 2; if (y > span) y = span * 2 - y;
      return y + BR;
    }
    function endMatch(win) {
      st = 'dead'; deadT = 0; endWin = win;
      if (win) { streaks[mode] = (streaks[mode] || 0) + 1; sfx.win(); K.confetti(null, null, 70); } else { streaks[mode] = 0; sfx.die(); addShake(8); }
      newBest = K.profile.submit(win ? streaks[mode] : 0, { won: win }).isBest;
      announce(win ? 'Victoria' : 'Derrota');
    }
    function endRally() {
      st = 'dead'; deadT = 0; sfx.die(); addShake(8);
      burst(ball.x, ball.y, 24, COL.magenta, { speed: 260, life: .7, grav: 300, size: 3.5 });
      newBest = K.profile.submit(hits).isBest;
      announce('Fallaste. ' + hits + ' golpes.');
    }
    function point(youScored) {
      addShake(6);
      burst(ball.x, ball.y, 22, youScored ? COL.cyan : COL.magenta, { speed: 260, life: .7, grav: 200, size: 3.5 });
      if (youScored) { you++; serveDir = 1; sfx.point(); } else { foe++; serveDir = -1; sfx.miss(); }
      hud.set(0, you, true); hud.set(1, foe, true);
      if (you >= 5) { endMatch(true); return; }
      if (foe >= 5) { endMatch(false); return; }
      st = 'serve'; serveT = 1.1; ball.x = W / 2; ball.y = H / 2; ball.vx = ball.vy = 0; ball.trail = [];
    }
    function paddleHit(b, px, dirX, vel) {
      const py0 = px === PXL ? py : ay, off = clamp((b.y - py0) / (PHT / 2), -1, 1);
      b.sp = Math.min(720, b.sp * 1.055 + 8);
      const a = off * 1.0;
      b.vx = Math.cos(a) * b.sp * dirX; b.vy = Math.sin(a) * b.sp + vel * .22;
      b.x = dirX > 0 ? px + PW + BR : px - BR;
      sfx.bounce(dirX > 0 ? 360 : 300);
      burst(b.x, b.y, 7, dirX > 0 ? COL.cyan : COL.magenta, { speed: 140, life: .3, grav: 80, size: 2.5, angle: dirX > 0 ? 0 : Math.PI, spread: 1.6 });
      if (px === PXL) flashL = 1; else flashR = 1;
    }

    function update(dt) {
      t += dt; flashL = Math.max(0, flashL - dt * 5); flashR = Math.max(0, flashR - dt * 5);
      const k = (keys.d ? 1 : 0) - (keys.u ? 1 : 0);
      if (k) pty = clamp(pty + k * 520 * dt, PHT / 2, H - PHT / 2);
      const old = py; py += clamp((pty - py) * Math.min(1, dt * 20), -900 * dt, 900 * dt); py = clamp(py, PHT / 2, H - PHT / 2);
      pv = (py - old) / Math.max(dt, .001);
      if (!rally && (st === 'play' || st === 'serve')) {
        const cfgAI = AI[mode] || AI.normal;
        thinkT -= dt; if (thinkT <= 0) { thinkT = cfgAI.react; ayT = (ball.vx > 0 && st === 'play' ? predict() : H / 2) + errOff; }
        ay += clamp(ayT - ay, -cfgAI.sp * dt, cfgAI.sp * dt); ay = clamp(ay, PHT / 2, H - PHT / 2);
      }
      if (st === 'serve') { serveT -= dt; if (serveT <= 0) serve(); }
      if (st === 'play') {
        const n = Math.max(1, Math.ceil(ball.sp * dt / 5)), h = dt / n;
        for (let i = 0; i < n && st === 'play'; i++) {
          ball.x += ball.vx * h; ball.y += ball.vy * h;
          if (ball.y < BR) { ball.y = BR; ball.vy = Math.abs(ball.vy); sfx.bounce(240); }
          else if (ball.y > H - BR) { ball.y = H - BR; ball.vy = -Math.abs(ball.vy); sfx.bounce(240); }
          if (ball.vx < 0 && ball.x - BR <= PXL + PW && ball.x + BR >= PXL && Math.abs(ball.y - py) <= PHT / 2 + BR) {
            paddleHit(ball, PXL, 1, pv);
            if (rally) { hits++; hud.set(0, hits, true); if (hits % 5 === 0) K.popText(W * .5, H * .3, hits, COL.amber, { size: 22 }); }
            else errOff = rand(-AI[mode].err, AI[mode].err);
          }
          if (rally) {
            if (ball.x + BR >= WALL && ball.vx > 0) { ball.x = WALL - BR; ball.vx = -Math.abs(ball.vx); ball.sp = Math.min(720, ball.sp * 1.02); sfx.bounce(300); flashR = 1; burst(WALL, ball.y, 6, COL.amber, { speed: 140, life: .3, grav: 80, size: 2.5, angle: Math.PI, spread: 1.6 }); }
          } else if (ball.vx > 0 && ball.x + BR >= PXR && ball.x - BR <= PXR + PW && Math.abs(ball.y - ay) <= PHT / 2 + BR) {
            paddleHit(ball, PXR, -1, 0);
          }
          if (ball.x < -BR) { if (rally) endRally(); else point(false); }
          else if (!rally && ball.x > W + BR) point(true);
        }
        ball.trail.push({ x: ball.x, y: ball.y }); if (ball.trail.length > 10) ball.trail.shift();
      }
      if (st === 'dead') deadT += dt;
      if (rally) hud.set(1, pad5(K.profile.best() || 0));
      else { hud.set(2, streaks[mode] || 0); hud.set(3, K.profile.best() || 0); }
    }

    function draw() {
      ctx.fillStyle = COL.ink; ctx.fillRect(-20, -20, W + 40, H + 40);
      ctx.fillStyle = rgba(COL.cyan, .04); for (let x = 0; x < W; x += 40) ctx.fillRect(x, 0, 1, H);
      ctx.strokeStyle = rgba(COL.cyan, .3); ctx.lineWidth = 2; ctx.strokeRect(1, 1, W - 2, H - 2);
      if (!rally) {
        ctx.fillStyle = rgba(COL.text, .22);
        for (let y = -((t * 30) % 24); y < H; y += 24) ctx.fillRect(W / 2 - 1.5, y, 3, 12);
        txt(String(you), W / 2 - 60, 46, { font: FD, size: 44, color: COL.cyan, alpha: .4 });
        txt(String(foe), W / 2 + 60, 46, { font: FD, size: 44, color: COL.magenta, alpha: .4 });
      } else {
        const g = ctx.createLinearGradient(WALL, 0, W, 0); g.addColorStop(0, rgba(COL.amber, .7 + flashR * .3)); g.addColorStop(1, rgba(COL.amber, .05));
        ctx.fillStyle = g; ctx.fillRect(WALL, 0, W - WALL, H);
        ctx.fillStyle = COL.amber; ctx.fillRect(WALL - 2, 0, 3, H);
        txt(String(hits), W / 2, 46, { font: FD, size: 44, color: COL.amber, alpha: .4 });
      }
      const pad = (x, y, col, fl) => {
        ctx.save();
        if (skin === 'retro') { ctx.fillStyle = fl > 0 ? COL.amber : COL.text; ctx.fillRect(x, y - PHT / 2, PW, PHT); ctx.restore(); return; }
        if (!cfg.low) { ctx.shadowColor = col; ctx.shadowBlur = 10 + fl * 16; }
        if (skin === 'plasma') { const g = ctx.createLinearGradient(0, y - PHT / 2, 0, y + PHT / 2); g.addColorStop(0, col); g.addColorStop(1, COL.violet); ctx.fillStyle = g; }
        else ctx.fillStyle = fl > 0 ? mix(col, COL.text, fl * .6) : col;
        rr(x, y - PHT / 2, PW, PHT, 5); ctx.fill(); ctx.restore();
      };
      pad(PXL, py, COL.cyan, flashL);
      if (!rally) pad(PXR, ay, COL.magenta, flashR);
      for (let i = 0; i < ball.trail.length; i++) { const q = ball.trail[i]; ctx.globalAlpha = i / ball.trail.length * .35; ctx.fillStyle = skin === 'plasma' ? COL.violet : COL.amber; ctx.beginPath(); ctx.arc(q.x, q.y, BR * (.4 + i / ball.trail.length * .6), 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
      if (st === 'play' || st === 'dead' || st === 'serve') {
        if (!cfg.low) { ctx.shadowColor = COL.amber; ctx.shadowBlur = 14; }
        ctx.fillStyle = COL.text; if (skin === 'retro') ctx.fillRect(ball.x - BR, ball.y - BR, BR * 2, BR * 2); else { ctx.beginPath(); ctx.arc(ball.x, ball.y, BR, 0, TAU); ctx.fill(); } ctx.shadowBlur = 0;
      }
      if (st === 'ready') {
        txt('NEON PONG', W / 2, H / 2 - 36, { font: FD, size: 36, color: COL.cyan });
        txt(rally ? 'Frontón: no dejes pasar la bola' : 'Primero en llegar a 5 gana', W / 2, H / 2 + 6, { size: 13 });
        txt('Toca o pulsa Espacio para empezar', W / 2, H / 2 + 30, { size: 12, color: COL.muted });
      }
      if (st === 'serve') { const n = Math.ceil(serveT / .37); const q = (serveT % .37) / .37; ctx.save(); ctx.translate(W / 2, H / 2 - 44); ctx.scale(.8 + q * .4, .8 + q * .4); txt(String(Math.max(1, Math.min(3, n))), 0, 0, { font: FD, size: 38, color: COL.amber, alpha: .5 + q * .5 }); ctx.restore(); }
      if (st === 'dead' && deadT > .3) {
        if (rally) banner(W, H, 'FALLASTE', COL.magenta, [hits + ' golpes' + (newBest ? ' · nuevo récord' : ''), 'Toca o Espacio para reintentar']);
        else banner(W, H, endWin ? 'VICTORIA' : 'DERROTA', endWin ? COL.lime : COL.magenta, [you + ' - ' + foe + (endWin ? ' · racha ' + (streaks[mode] || 0) : '') + (newBest ? ' · nuevo récord' : ''), 'Toca o Espacio para jugar otra']);
      }
    }

    function setMode(id) { mode = id; rally = id === 'rally'; hudFor(); reset(); }
    return {
      W, H,
      enter(id) { setMode(id); },
      setMode,
      leave() { keys.u = keys.d = false; },
      blur() { keys.u = keys.d = false; },
      update, draw,
      down(p) { pty = clamp(p.y, PHT / 2, H - PHT / 2); start(); },
      move(p) { pty = clamp(p.y, PHT / 2, H - PHT / 2); },
      up() {},
      controls(el) {
        K.pad.buttons(el, [
          { label: '▲', cls: 'sq', down: () => { keys.u = true; }, up: () => { keys.u = false; } },
          { label: 'SACAR', down: start },
          { label: '▼', cls: 'sq', down: () => { keys.d = true; }, up: () => { keys.d = false; } }
        ]);
      },
      key(e, down) {
        const c = e.code;
        if (c === 'ArrowUp' || c === 'KeyW') { keys.u = down; return true; }
        if (c === 'ArrowDown' || c === 'KeyS') { keys.d = down; return true; }
        if (c === 'Space') { if (down && !e.repeat) start(); return true; }
        return false;
      },
      state: () => ({ ball: { x: ball.x, y: ball.y, vx: ball.vx }, py, ay, you, foe, hits, st }),
      setSkin(id) { skin = id; K.redraw(); },
      init() { reset(); }
    };
  }
});
