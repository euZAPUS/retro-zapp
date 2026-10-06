/* Floppy Byte · vuelo infinito entre firewalls, con cuatro modos */
ZAP.register({
  id: 'flappy', name: 'Floppy Byte', tag: 'aletea entre los firewalls', genre: 'Acción', color: 'cyan', icon: 'flappy',
  modes: [
    { id: 'normal', name: 'Normal', desc: 'Gravedad y huecos de siempre.' },
    { id: 'moon', name: 'Luna', desc: 'Gravedad lunar: flotas más y caes despacio.' },
    { id: 'narrow', name: 'Rendija', desc: 'Huecos muy estrechos. Precisión milimétrica.' },
    { id: 'moving', name: 'Móviles', desc: 'Los firewalls suben y bajan mientras te acercas.' }
  ],
  skins: [{ id: 'byte', name: 'Byte', lvl: 0 }, { id: 'phoenix', name: 'Fénix', lvl: 2 }, { id: 'ghost', name: 'Espectro', lvl: 4 }, { id: 'gold', name: 'Dorado', lvl: 6 }],
  hint: '<kbd>Espacio</kbd>, <kbd>↑</kbd>, clic o toca la pantalla para aletear. Pasa por el hueco de cada firewall. Medallas: bronce a 10, plata a 25, oro a 50.',
  ach: [
    { id: 'flap25', name: 'Piloto', desc: '25 firewalls en una partida de Floppy Byte', icon: 'flappy', test: (p, r) => !!r && r.game === 'flappy' && r.value >= 25 },
    { id: 'flapnarrow', name: 'Ojo de aguja', desc: '10 firewalls en Rendija', icon: 'bolt', test: (p, r) => !!r && r.game === 'flappy' && r.mode === 'narrow' && r.value >= 10 }
  ],
  create(K) {
    const { ctx, COL, TAU, clamp, rand, mix, rgba, txt, banner, rr, burst, sfx, hud, pad5, addShake, announce, FD, cfg } = K;
    const W = 360, H = 540, GY = 472, BX = 96, BRAD = 11, PW = 58, SPACING = 200;
    const MODES = {
      normal: { g: 1500, flap: 440, sp: 150, gap: 150 },
      moon: { g: 620, flap: 285, sp: 125, gap: 150 },
      narrow: { g: 1500, flap: 440, sp: 160, gap: 112 },
      moving: { g: 1500, flap: 440, sp: 150, gap: 156, move: true }
    };
    let M = MODES.normal, skin = 'byte';
    let st, t = 0, by, vy, pipes, score, deadT, newBest, groundOff, bgOff, wing, since;
    const stars = Array.from({ length: 36 }, () => ({ x: rand(0, W), y: rand(0, GY - 120), r: Math.random() < .2 ? 2 : 1, p: rand(0, TAU) }));
    function skyline(sp, hr, wr, al) {
      const b = []; let x = 0;
      while (x < W + 160) { const w = Math.floor(rand(wr[0], wr[1])); b.push({ x, w, h: Math.floor(rand(hr[0], hr[1])) }); x += w + Math.floor(rand(2, 8)); }
      return { sp, al, b, L: x };
    }
    const sky = [skyline(.15, [50, 130], [30, 60], .08), skyline(.35, [40, 100], [24, 46], .16)];

    function reset() {
      st = 'ready'; by = H / 2 - 30; vy = 0; pipes = []; score = 0; deadT = 0; newBest = false; groundOff = 0; bgOff = 0; wing = 0; since = SPACING - 40;
    }
    function flap() {
      if (st === 'dead') { if (deadT > .55) reset(); return; }
      if (st === 'ready') st = 'play';
      vy = -M.flap; wing = 1; sfx.flap();
      burst(BX - 8, by + 6, 4, rgba(COL.cyan, .8), { speed: 70, life: .35, grav: 60, size: 2.5, angle: Math.PI * .75, spread: 1 });
    }
    function die() {
      if (st === 'dead') return;
      st = 'dead'; deadT = 0; addShake(9); sfx.die();
      burst(BX, by, 26, COL.cyan, { speed: 280, life: .9, grav: 500, size: 3.5 });
      burst(BX, by, 10, COL.magenta, { speed: 200, life: .7, grav: 400, size: 3 });
      newBest = K.profile.submit(score).isBest;
      announce('Fin del vuelo. ' + score + ' puntos.');
    }
    const medal = s => s >= 50 ? 'ORO' : s >= 25 ? 'PLATA' : s >= 10 ? 'BRONCE' : '--';
    function spawn() {
      const margin = 56, gap = M.gap;
      pipes.push({ x: W + 40, base: rand(margin + gap / 2, GY - margin - gap / 2), gap, ph: rand(0, TAU), amp: M.move ? 38 : 0, scored: false });
    }
    const gapY = p => p.base + Math.sin(t * 1.7 + p.ph) * p.amp;

    function update(dt) {
      t += dt; wing = Math.max(0, wing - dt * 6);
      if (st !== 'dead') { groundOff += M.sp * dt; bgOff += M.sp * dt; }
      if (st === 'ready') by = H / 2 - 30 + Math.sin(t * 4) * 8;
      if (st === 'play') {
        vy += M.g * dt; by += vy * dt;
        if (by < BRAD) { by = BRAD; vy = Math.max(0, vy); }
        since += M.sp * dt;
        if (since >= SPACING) { since = 0; spawn(); }
        for (const p of pipes) {
          p.x -= M.sp * dt;
          if (!p.scored && p.x + PW < BX - BRAD) {
            p.scored = true; score++; sfx.point(); hud.bump(0);
            K.popText(BX + 30, by - 28, score, COL.amber);
            if (score === 10 || score === 25 || score === 50) { K.confetti(null, null, 50); K.popText(W / 2, 120, medal(score), COL.lime, { size: 22, life: 1.4 }); }
          }
          const gy = gapY(p), top = gy - p.gap / 2, bot = gy + p.gap / 2;
          if (BX + BRAD > p.x && BX - BRAD < p.x + PW) {
            if (by - BRAD < top || by + BRAD > bot) die();
          }
        }
        pipes = pipes.filter(p => p.x > -PW - 10);
        if (by + BRAD >= GY) { by = GY - BRAD; die(); }
      } else if (st === 'dead') {
        deadT += dt;
        if (by + BRAD < GY) { vy += M.g * dt; by = Math.min(GY - BRAD, by + vy * dt); }
      }
      hud.set(0, pad5(score)); hud.set(1, pad5(K.profile.best() || 0)); hud.set(2, medal(score));
    }

    function drawPipe(p) {
      const gy = gapY(p), top = gy - p.gap / 2, bot = gy + p.gap / 2, x = p.x;
      const body = mix(COL.lime, COL.ink, .62), edge = COL.lime;
      for (const [y0, y1, cap] of [[0, top, top], [bot, GY, bot]]) {
        ctx.fillStyle = body; ctx.fillRect(x + 4, y0, PW - 8, y1 - y0);
        ctx.fillStyle = rgba(edge, .9); ctx.fillRect(x + 4, y0, 3, y1 - y0); ctx.fillRect(x + PW - 7, y0, 3, y1 - y0);
        ctx.fillStyle = rgba(COL.ink, .4); for (let yy = y0 + ((cap === top ? 0 : 6) % 12); yy < y1; yy += 12) ctx.fillRect(x + 7, yy, PW - 14, 1);
        const cy = cap === top ? top - 16 : bot;
        ctx.fillStyle = edge; ctx.fillRect(x, cy, PW, 16);
        ctx.fillStyle = rgba(COL.text, .3); ctx.fillRect(x, cy, PW, 3);
        ctx.fillStyle = rgba(COL.ink, .35); ctx.fillRect(x, cy + 13, PW, 3);
      }
      if (p.amp) { ctx.fillStyle = rgba(COL.amber, .7); ctx.beginPath(); ctx.moveTo(x + PW / 2, gy - 6); ctx.lineTo(x + PW / 2 - 5, gy); ctx.lineTo(x + PW / 2 + 5, gy); ctx.fill(); ctx.beginPath(); ctx.moveTo(x + PW / 2, gy + 6); ctx.lineTo(x + PW / 2 - 5, gy); ctx.lineTo(x + PW / 2 + 5, gy); ctx.fill(); }
    }
    function drawBird() {
      const rot = st === 'ready' ? 0 : clamp(vy / 520, -.5, 1.2);
      const bc = skin === 'phoenix' ? [COL.amber, COL.magenta] : skin === 'ghost' ? [COL.text, COL.violet] : skin === 'gold' ? [COL.amber, COL.text] : [COL.cyan, COL.magenta];
      ctx.save(); ctx.translate(BX, by); ctx.rotate(rot); if (skin === 'ghost') ctx.globalAlpha = .78;
      if (!cfg.low) { ctx.shadowColor = bc[0]; ctx.shadowBlur = skin === 'gold' ? 22 : 14; }
      ctx.fillStyle = bc[0]; rr(-14, -11, 28, 22, 6); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = mix(bc[0], COL.ink, .35); ctx.fillRect(-14, 4, 28, 7);
      ctx.fillStyle = rgba(COL.text, .3); ctx.fillRect(-10, -9, 16, 3);
      ctx.fillStyle = COL.text; ctx.fillRect(3, -7, 8, 8); ctx.fillStyle = COL.ink; ctx.fillRect(7, -5, 4, 5);
      ctx.fillStyle = bc[1]; ctx.fillRect(12, 0, 8, 5); ctx.fillStyle = mix(bc[1], COL.ink, .4); ctx.fillRect(12, 4, 8, 2);
      const wy = Math.sin(t * 22) * 4 * (st === 'dead' ? 0 : 1) - wing * 3;
      ctx.fillStyle = mix(bc[0], COL.text, .5); ctx.fillRect(-12, 1 + wy, 12, 6);
      ctx.restore();
    }
    function draw() {
      const g = ctx.createLinearGradient(0, 0, 0, GY); g.addColorStop(0, mix(COL.ink, COL.violet, .05)); g.addColorStop(1, mix(COL.ink, COL.cyan, .18));
      ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);
      for (const s of stars) { ctx.globalAlpha = .25 + .3 * Math.sin(t * 2 + s.p); ctx.fillStyle = COL.text; ctx.fillRect(s.x, s.y, s.r, s.r); }
      ctx.globalAlpha = 1;
      sky.forEach((layer, li) => {
        const off = (bgOff * layer.sp) % layer.L; ctx.fillStyle = mix(COL.ink, COL.cyan, layer.al);
        for (const rep of [-off, -off + layer.L]) for (const b of layer.b) { const x = b.x + rep; if (x > W || x + b.w < 0) continue; ctx.fillRect(x, GY - b.h, b.w, b.h); }
      });
      for (const p of pipes) drawPipe(p);
      ctx.fillStyle = mix(COL.ink, COL.cyan, .1); ctx.fillRect(0, GY, W, H - GY);
      ctx.fillStyle = COL.cyan; ctx.fillRect(0, GY, W, 3);
      ctx.fillStyle = rgba(COL.cyan, .35);
      for (let x = -(groundOff % 40); x < W; x += 40) ctx.fillRect(x, GY + 16, 20, 2);
      for (let x = -((groundOff * 1.4) % 56) + 18; x < W; x += 56) ctx.fillRect(x, GY + 36, 10, 2);
      drawBird();
      if (st === 'play') txt(String(score), W / 2, 56, { font: FD, size: 44, color: COL.text, alpha: .85 });
      if (st === 'ready') {
        txt('FLOPPY BYTE', W / 2, 150, { font: FD, size: 30, color: COL.cyan });
        txt('Toca o pulsa Espacio para aletear', W / 2, 190, { size: 13 });
      }
      if (st === 'dead' && deadT > .4) banner(W, H, 'FIN DEL VUELO', COL.magenta, [pad5(score) + ' puntos · medalla ' + medal(score) + (newBest ? ' · nuevo récord' : ''), 'Toca o Espacio para reintentar']);
    }

    function setMode(id) { M = MODES[id] || MODES.normal; reset(); }
    return {
      W, H,
      enter(id) { hud.init(['Puntos', 'Récord', 'Medalla']); setMode(id); },
      setMode,
      update, draw,
      down() { flap(); },
      controls(el) { K.pad.buttons(el, [{ label: 'ALETEAR', down: flap }]); },
      key(e, down) {
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { if (down && !e.repeat) flap(); return true; }
        return false;
      },
      state: () => ({ by, vy, st, score, pipes: pipes.map(p => ({ x: p.x, gy: gapY(p), gap: p.gap })) }),
      setSkin(id) { skin = id; K.redraw(); },
      init() { reset(); }
    };
  }
});
