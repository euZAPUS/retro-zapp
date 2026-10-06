/* Memory Match · parejas con giro 3D, y un modo donde las cartas se barajan */
ZAP.register({
  id: 'memory', name: 'Memory Match', tag: 'encuentra todas las parejas', genre: 'Puzzle', color: 'lime', icon: 'memory',
  metric: { label: 'Tiempo', better: 'low', fmt: v => ZAP.fmtTime(v) },
  modes: [
    { id: 'easy', name: 'Fácil 4×3', desc: '6 parejas. Perfecto para empezar.' },
    { id: 'normal', name: 'Normal 4×4', desc: '8 parejas.' },
    { id: 'hard', name: 'Difícil 6×4', desc: '12 parejas. Memoria de elefante.' },
    { id: 'shuffle', name: 'Barajado', desc: '4×4 donde cada tres fallos se barajan las cartas que quedan.' }
  ],
  hint: 'Haz clic o toca para dar la vuelta a dos cartas. Si coinciden se quedan descubiertas. El reloj empieza con la primera carta; gana el que termine antes. <kbd>R</kbd> reinicia.',
  ach: [
    { id: 'memperfect', name: 'Memoria fotográfica', desc: 'Termina Normal sin ningún fallo', icon: 'memory', test: (p, r) => !!r && r.game === 'memory' && r.mode === 'normal' && r.value != null && r.extra && r.extra.misses === 0 },
    { id: 'memhard', name: 'Elefante', desc: 'Completa el modo Difícil', icon: 'crown', test: (p, r) => !!r && r.game === 'memory' && r.mode === 'hard' && r.value != null }
  ],
  create(K) {
    const { ctx, COL, TAU, clamp, rand, mix, rgba, txt, banner, rr, burst, sfx, hud, addShake, announce, easeOutBack, easeOutCubic, FD, cfg } = K;
    const CW = 88, CH = 108, G = 12;
    const MODES = { easy: { c: 4, r: 3 }, normal: { c: 4, r: 4 }, hard: { c: 6, r: 4 }, shuffle: { c: 4, r: 4, shuffle: true } };
    let M = MODES.normal, W = 430, H = 492;
    let cards, first, second, lock, st, t = 0, moves, misses, time, matched, endT, newBest, started;
    const cols = () => [COL.cyan, COL.magenta, COL.amber, COL.lime, COL.violet, mix(COL.cyan, COL.lime, .5), mix(COL.magenta, COL.amber, .5), mix(COL.violet, COL.cyan, .5), mix(COL.amber, COL.lime, .5), mix(COL.magenta, COL.violet, .5), mix(COL.cyan, COL.magenta, .5), mix(COL.lime, COL.violet, .5)];
    const pos = i => ({ x: G + (i % M.c) * (CW + G), y: G + ((i / M.c) | 0) * (CH + G) });

    function sym(k, x, y, s, col) {
      ctx.save(); ctx.translate(x, y); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = s * .16; ctx.lineJoin = 'round';
      ctx.beginPath();
      switch (k % 12) {
        case 0: ctx.arc(0, 0, s * .55, 0, TAU); ctx.fill(); break;
        case 1: ctx.rect(-s * .5, -s * .5, s, s); ctx.fill(); break;
        case 2: ctx.moveTo(0, -s * .6); ctx.lineTo(s * .6, s * .5); ctx.lineTo(-s * .6, s * .5); ctx.closePath(); ctx.fill(); break;
        case 3: ctx.moveTo(0, -s * .65); ctx.lineTo(s * .5, 0); ctx.lineTo(0, s * .65); ctx.lineTo(-s * .5, 0); ctx.closePath(); ctx.fill(); break;
        case 4: for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * .27 : s * .62; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); break;
        case 5: ctx.moveTo(-s * .55, 0); ctx.lineTo(s * .55, 0); ctx.moveTo(0, -s * .55); ctx.lineTo(0, s * .55); ctx.stroke(); break;
        case 6: for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.lineTo(Math.cos(a) * s * .6, Math.sin(a) * s * .6); } ctx.closePath(); ctx.fill(); break;
        case 7: ctx.moveTo(0, s * .55); ctx.bezierCurveTo(-s * .9, -s * .1, -s * .4, -s * .8, 0, -s * .25); ctx.bezierCurveTo(s * .4, -s * .8, s * .9, -s * .1, 0, s * .55); ctx.fill(); break;
        case 8: ctx.moveTo(s * .15, -s * .65); ctx.lineTo(-s * .35, s * .05); ctx.lineTo(0, s * .05); ctx.lineTo(-s * .15, s * .65); ctx.lineTo(s * .35, -s * .05); ctx.lineTo(0, -s * .05); ctx.closePath(); ctx.fill(); break;
        case 9: ctx.arc(0, 0, s * .55, .6, TAU - .6); ctx.arc(s * .18, 0, s * .4, TAU - .9, .9, true); ctx.fill(); break;
        case 10: ctx.arc(0, 0, s * .5, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, s * .16, 0, TAU); ctx.fill(); break;
        default: ctx.moveTo(-s * .55, s * .4); ctx.lineTo(0, -s * .45); ctx.lineTo(s * .55, s * .4); ctx.stroke(); break;
      }
      ctx.restore();
    }

    function reset() {
      const n = M.c * M.r, pairs = n / 2, order = [];
      for (let i = 0; i < pairs; i++) order.push(i, i);
      for (let i = order.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
      W = M.c * (CW + G) + G; H = M.r * (CH + G) + G;
      cards = order.map((k, i) => ({ k, flip: 0, face: false, done: false, shake: 0, pulse: 0, x: pos(i).x, y: pos(i).y, from: null, mt: 1 }));
      first = second = null; pending = null; lock = 0; st = 'play'; moves = 0; misses = 0; time = 0; matched = 0; endT = 0; newBest = false; started = false;
      if (active) K.sizeCanvas(W, H);
      sync();
    }
    let active = false;
    function sync() { hud.set(0, moves); hud.set(1, Math.floor(time) + ' s'); const b = K.profile.best(); hud.set(2, b != null ? b + ' s' : '--'); }
    function reshuffle() {
      const idx = cards.map((c, i) => i).filter(i => !cards[i].done);
      const slots = idx.slice(); for (let i = slots.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [slots[i], slots[j]] = [slots[j], slots[i]]; }
      const copy = idx.map(i => cards[i]);
      idx.forEach((i, n) => { const c = copy[n], p = pos(slots[n]); c.from = { x: c.x, y: c.y }; c.tx = p.x; c.ty = p.y; c.mt = 0; });
      // reordenar el array para que el índice coincida con la posición
      const out = cards.slice(); idx.forEach((i, n) => { out[slots[n]] = copy[n]; }); cards = out;
      sfx.swish(); K.popText(W / 2, H / 2, '¡BARAJADO!', COL.amber, { size: 20 });
    }
    function pick(i) {
      if (st === 'dead') { if (t - endT > .6) reset(); return; }
      const c = cards[i]; if (!c || c.done || c.face || lock > 0 || c.mt < 1) return;
      if (!started) started = true;
      c.face = true; sfx.flip();
      if (first === null) { first = i; return; }
      second = i; moves++; lock = .1;
      const a = cards[first], b = c;
      if (a.k === b.k) {
        lock = .35;
        a.pulse = b.pulse = 1; a.done = b.done = true; matched += 2; sfx.match();
        for (const q of [a, b]) burst(q.x + CW / 2, q.y + CH / 2, 14, cols()[q.k], { speed: 220, life: .7, grav: 300, size: 3.5 });
        first = second = null;
        if (matched === cards.length) win();
      } else {
        misses++; lock = .75; a.shake = b.shake = 1; sfx.nomatch();
        const fi = first, si = second;
        pending = { fi, si, t: .7 };
        first = second = null;
      }
      sync();
    }
    let pending = null;
    function win() {
      st = 'dead'; endT = t; sfx.win(); K.confetti(null, null, 80);
      const secs = Math.max(1, Math.round(time));
      newBest = K.profile.submit(secs, { moves, misses }).isBest;
      announce('Completado en ' + secs + ' segundos y ' + moves + ' movimientos.');
    }

    function update(dt) {
      t += dt;
      if (st === 'play' && started) time += dt;
      lock = Math.max(0, lock - dt);
      if (pending) {
        pending.t -= dt;
        if (pending.t <= 0) {
          cards[pending.fi].face = false; cards[pending.si].face = false; pending = null;
          if (M.shuffle && misses % 3 === 0 && matched < cards.length) reshuffle();
        }
      }
      for (const c of cards) {
        const target = c.face || c.done ? 1 : 0; c.flip += clamp(target - c.flip, -dt * 6, dt * 6);
        c.shake = Math.max(0, c.shake - dt * 2.5); c.pulse = Math.max(0, c.pulse - dt * 2.5);
        if (c.mt < 1) { c.mt = Math.min(1, c.mt + dt * 2.2); const q = easeOutCubic(c.mt); c.x = c.from.x + (c.tx - c.from.x) * q; c.y = c.from.y + (c.ty - c.from.y) * q; if (c.mt >= 1) { c.x = c.tx; c.y = c.ty; } }
      }
      sync();
    }

    function draw() {
      ctx.fillStyle = COL.ink; ctx.fillRect(-20, -20, W + 40, H + 40);
      const C = cols();
      cards.forEach((c, i) => {
        const sx = Math.abs(Math.cos(c.flip * Math.PI)), showFace = c.flip > .5;
        const sh = Math.sin(c.shake * 30) * 4 * c.shake, lift = c.pulse * 6;
        ctx.save(); ctx.translate(c.x + CW / 2 + sh, c.y + CH / 2 - lift); ctx.scale(Math.max(.02, sx) * (1 + c.pulse * .08), 1 + c.pulse * .08);
        const col = C[c.k % C.length];
        if (showFace) {
          ctx.fillStyle = mix(COL.panel, col, .18); rr(-CW / 2, -CH / 2, CW, CH, 12); ctx.fill();
          ctx.strokeStyle = rgba(col, c.done ? .9 : .6); ctx.lineWidth = 2; ctx.stroke();
          if (!cfg.low) { ctx.shadowColor = col; ctx.shadowBlur = c.done ? 16 : 8; }
          sym(c.k, 0, 0, 38, col); ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = mix(COL.panel, COL.text, .08); rr(-CW / 2, -CH / 2, CW, CH, 12); ctx.fill();
          ctx.strokeStyle = rgba(COL.cyan, .35); ctx.lineWidth = 2; ctx.stroke();
          ctx.strokeStyle = rgba(COL.cyan, .18); ctx.lineWidth = 1;
          for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(-CW / 2 + 6, k * 14); ctx.lineTo(CW / 2 - 6, k * 14 + 20); ctx.stroke(); }
          txt('?', 0, 2, { font: FD, size: 30, color: COL.cyan, alpha: .7 });
        }
        ctx.restore();
      });
      if (st === 'dead' && t - endT > .5) banner(W, H, '¡COMPLETADO!', COL.lime, [Math.round(time) + ' s · ' + moves + ' movimientos · ' + misses + ' fallos' + (newBest ? ' · nuevo récord' : ''), 'Toca o pulsa R para otra partida']);
      if (!started && st === 'play') txt('Toca una carta para empezar', W / 2, H - 2, { size: 11, color: COL.muted, base: 'bottom' });
    }

    function setMode(id) { M = MODES[id] || MODES.normal; reset(); }
    function idxAt(p) {
      for (let i = 0; i < cards.length; i++) { const c = cards[i]; if (p.x >= c.x && p.x <= c.x + CW && p.y >= c.y && p.y <= c.y + CH) return i; }
      return -1;
    }
    return {
      get W() { return W; }, get H() { return H; },
      enter(id) { active = true; hud.init(['Movimientos', 'Tiempo', 'Récord']); setMode(id); },
      setMode,
      leave() { active = false; },
      update, draw,
      down(p) { const i = idxAt(p); if (st === 'dead') { pick(0); return; } if (i >= 0) pick(i); },
      key(e, down) { if (down && e.code === 'KeyR') { reset(); return true; } return false; },
      controls(el) { K.pad.buttons(el, [{ label: 'Nueva partida', cls: 'sm', click: reset }], true); },
      state: () => ({ cards: cards.map(c => ({ k: c.k, x: c.x, y: c.y, done: c.done, face: c.face, mt: c.mt })), st, moves, misses, matched, lock, W, H }),
      init() { reset(); }
    };
  }
});
