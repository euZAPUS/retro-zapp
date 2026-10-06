/* Bug Smasher · aplasta bugs, esquiva las bombas */
ZAP.register({
  id: 'whack', name: 'Bug Smasher', tag: 'aplasta bugs, evita las bombas', genre: 'Reflejos', color: 'amber', icon: 'whack',
  modes: [
    { id: 'classic', name: 'Clásico 30 s', desc: 'Treinta segundos. Cuantos más bugs, mejor.' },
    { id: 'survival', name: 'Supervivencia', desc: 'Tres vidas: cada bug que escapa te cuesta una.' },
    { id: 'bombs', name: 'Campo minado', desc: '30 s con muchísimas bombas. Mira antes de pulsar.' }
  ],
  hint: 'Haz clic o toca los <b>bugs verdes</b> (+10). Los <b>dorados</b> valen 30 y duran poco. Las <b>bombas</b> te restan puntos: no las toques. Encadena aciertos sin fallar para subir el multiplicador.',
  ach: [
    { id: 'whack300', name: 'Exterminador', desc: '300 puntos en Bug Smasher', icon: 'whack', test: (p, r) => !!r && r.game === 'whack' && r.value >= 300 },
    { id: 'whackbomb', name: 'Desactivador', desc: '150 puntos en Campo minado', icon: 'skull', test: (p, r) => !!r && r.game === 'whack' && r.mode === 'bombs' && r.value >= 150 }
  ],
  create(K) {
    const { ctx, COL, TAU, clamp, rand, randInt, mix, rgba, txt, banner, burst, sfx, hud, pad5, addShake, announce, easeOutBack, FD, cfg } = K;
    const W = 480, H = 480, X0 = 80, Y0 = 150, DX = 160, DY = 124;
    const MODES = { classic: { time: 30, bomb: .12, lives: 0 }, survival: { time: 0, bomb: .1, lives: 3 }, bombs: { time: 30, bomb: .34, lives: 0 } };
    let M = MODES.classic;
    let st, t = 0, holes, score, combo, bestCombo, timeLeft, lives, spawnT, elapsed, deadT, newBest, hits, swing = 0, mx = W / 2, my = H / 2, rings = [], started;
    const hx = i => X0 + (i % 3) * DX, hy = i => Y0 + ((i / 3) | 0) * DY;

    function reset() {
      holes = Array.from({ length: 9 }, () => ({ k: null, t: 0, life: 0, pop: 0, hit: 0 }));
      st = 'ready'; score = 0; combo = 0; bestCombo = 0; timeLeft = M.time; lives = M.lives; spawnT = .6; elapsed = 0; deadT = 0; newBest = false; hits = 0; rings = []; started = false;
      syncHud();
    }
    const mult = () => 1 + Math.floor(combo / 5);
    function syncHud() { hud.set(0, pad5(score), true); hud.set(1, pad5(K.profile.best() || 0)); hud.set(2, M.lives ? '♥'.repeat(Math.max(0, lives)) : Math.ceil(timeLeft) + ' s'); }
    function spawn() {
      const free = holes.map((h, i) => (h.k ? -1 : i)).filter(i => i >= 0);
      if (!free.length) return;
      const i = free[(Math.random() * free.length) | 0], h = holes[i], r = Math.random();
      h.k = r < M.bomb ? 'bomb' : r < M.bomb + .1 ? 'gold' : 'bug';
      const base = Math.max(.5, 1.15 - elapsed * (M.lives ? .014 : .01));
      h.life = h.k === 'gold' ? base * .65 : base; h.t = 0; h.pop = 0; h.hit = 0;
    }
    function strike(x, y) {
      if (st === 'dead') { if (deadT > .6) reset(); return; }
      if (st === 'ready') { st = 'play'; started = true; }
      if (st !== 'play') return;
      swing = 1; rings.push({ x, y, t: 0 });
      let target = -1, bd = 1e9;
      holes.forEach((h, i) => { if (!h.k || h.hit) return; const d = Math.hypot(x - hx(i), y - (hy(i) - 28 * Math.min(1, h.pop))); if (d < 58 && d < bd) { bd = d; target = i; } });
      if (target < 0) { combo = 0; sfx.swish(); return; }
      const h = holes[target], cx = hx(target), cy = hy(target) - 30;
      h.hit = 1;
      if (h.k === 'bomb') {
        combo = 0; score = Math.max(0, score - 20); addShake(10); sfx.boom();
        burst(cx, cy, 30, COL.magenta, { speed: 320, life: .8, grav: 300, size: 4 }); burst(cx, cy, 14, COL.amber, { speed: 220, life: .6, grav: 200, size: 3 });
        K.popText(cx, cy - 30, '-20', COL.magenta, { size: 18 });
        if (M.lives) { lives--; if (lives <= 0) { finish(); return; } }
      } else {
        const pts = (h.k === 'gold' ? 30 : 10) * mult(); combo++; hits++; bestCombo = Math.max(bestCombo, combo); score += pts;
        sfx.brick(Math.min(10, combo)); if (h.k === 'gold') sfx.bonus();
        burst(cx, cy, h.k === 'gold' ? 22 : 14, h.k === 'gold' ? COL.amber : COL.lime, { speed: 240, life: .6, grav: 350, size: 3.5 });
        K.popText(cx, cy - 34, '+' + pts + (mult() > 1 ? ' x' + mult() : ''), h.k === 'gold' ? COL.amber : COL.lime, { size: 15 });
      }
      syncHud();
    }
    function finish() {
      st = 'dead'; deadT = 0; sfx.win();
      newBest = K.profile.submit(score, { hits, combo: bestCombo }).isBest;
      announce('Fin. ' + score + ' puntos.');
    }

    function update(dt) {
      t += dt; swing = Math.max(0, swing - dt * 7);
      for (let i = rings.length - 1; i >= 0; i--) { rings[i].t += dt; if (rings[i].t > .35) rings.splice(i, 1); }
      for (const h of holes) {
        if (h.hit) { h.hit -= dt * 3.5; if (h.hit <= 0) { h.k = null; h.hit = 0; h.pop = 0; } else h.pop = Math.max(0, h.pop - dt * 4); continue; }
        if (!h.k) continue;
        h.t += dt; h.pop = h.t < .14 ? h.t / .14 : h.t > h.life - .14 ? Math.max(0, (h.life - h.t) / .14) : 1;
        if (h.t >= h.life) {
          if (h.k !== 'bomb') { combo = 0; if (M.lives && st === 'play') { lives--; addShake(5); sfx.miss(); syncHud(); if (lives <= 0) finish(); } }
          h.k = null; h.pop = 0;
        }
      }
      if (st === 'play') {
        elapsed += dt;
        if (M.time) { timeLeft -= dt; if (timeLeft <= 0) { timeLeft = 0; finish(); } syncHud(); }
        spawnT -= dt;
        if (spawnT <= 0) { spawn(); if (elapsed > 12 && Math.random() < .35) spawn(); spawnT = Math.max(.32, .95 - elapsed * (M.lives ? .014 : .012)) * rand(.7, 1.2); }
      }
      if (st === 'dead') deadT += dt;
    }

    function critter(h, x, y) {
      const k = h.k, s = easeOutBack(clamp(h.pop, 0, 1)), sq = h.hit ? .45 : 1;
      ctx.save(); ctx.translate(x, y - 6 + (1 - Math.min(1, h.pop)) * 70); ctx.scale(1, Math.max(.05, s) * sq * (h.hit ? 1 : 1));
      const col = k === 'bomb' ? COL.magenta : k === 'gold' ? COL.amber : COL.lime;
      if (!cfg.low && k !== 'bomb') { ctx.shadowColor = col; ctx.shadowBlur = k === 'gold' ? 16 : 8; }
      if (k === 'bomb') {
        ctx.fillStyle = mix(COL.ink, COL.panel, .9); ctx.beginPath(); ctx.arc(0, -26, 28, 0, TAU); ctx.fill();
        ctx.strokeStyle = rgba(COL.magenta, .9); ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = COL.magenta; ctx.fillRect(-4, -6 - 26 - 28 + 18, 8, 6);
        ctx.strokeStyle = COL.amber; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -60); ctx.quadraticCurveTo(10, -72, 18, -64); ctx.stroke();
        ctx.fillStyle = Math.floor(t * 12) % 2 ? COL.amber : COL.magenta; ctx.beginPath(); ctx.arc(18, -64, 4, 0, TAU); ctx.fill();
        txt('✕', 0, -25, { font: FD, size: 22, color: COL.magenta });
      } else {
        ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, -26, 30, 27, 0, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = rgba(COL.text, .3); ctx.beginPath(); ctx.ellipse(-8, -38, 12, 7, -.4, 0, TAU); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-12, -48); ctx.lineTo(-20, -64); ctx.moveTo(12, -48); ctx.lineTo(20, -64); ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(-20, -64, 3, 0, TAU); ctx.arc(20, -64, 3, 0, TAU); ctx.fill();
        ctx.fillStyle = COL.text; ctx.beginPath(); ctx.arc(-10, -28, 7, 0, TAU); ctx.arc(10, -28, 7, 0, TAU); ctx.fill();
        ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(-9 + Math.sin(t * 3) * 1.5, -27, 3.2, 0, TAU); ctx.arc(11 + Math.sin(t * 3) * 1.5, -27, 3.2, 0, TAU); ctx.fill();
        ctx.strokeStyle = COL.ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, -14, 8, .1, Math.PI - .1); ctx.stroke();
        if (k === 'gold') { ctx.fillStyle = COL.text; ctx.globalAlpha = .6 + .4 * Math.sin(t * 12); ctx.fillRect(18, -50, 3, 9); ctx.fillRect(15, -47, 9, 3); ctx.globalAlpha = 1; }
      }
      ctx.restore();
    }
    function draw() {
      ctx.fillStyle = COL.ink; ctx.fillRect(-20, -20, W + 40, H + 40);
      ctx.fillStyle = rgba(COL.lime, .035); for (let y = 0; y < H; y += 30) ctx.fillRect(0, y, W, 1);
      for (let i = 0; i < 9; i++) {
        const x = hx(i), y = hy(i), h = holes[i];
        ctx.fillStyle = mix(COL.ink, COL.panel, .9); ctx.beginPath(); ctx.ellipse(x, y + 4, 64, 22, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#000'; ctx.globalAlpha = .55; ctx.beginPath(); ctx.ellipse(x, y + 6, 56, 16, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
        if (h.k) {
          ctx.save(); ctx.beginPath(); ctx.rect(x - 90, y - 140, 180, 140 + 8); ctx.clip();
          critter(h, x, y); ctx.restore();
        }
        ctx.strokeStyle = rgba(COL.cyan, .35); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y + 4, 64, 22, 0, 0, Math.PI); ctx.stroke();
        ctx.strokeStyle = rgba(COL.text, .15); ctx.beginPath(); ctx.ellipse(x, y + 4, 64, 22, 0, Math.PI, TAU); ctx.stroke();
      }
      for (const r of rings) { const q = r.t / .35; ctx.strokeStyle = rgba(COL.amber, 1 - q); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(r.x, r.y, 8 + q * 34, 0, TAU); ctx.stroke(); }
      if (K.canHover && st === 'play') {
        ctx.save(); ctx.translate(mx + 6, my - 6); ctx.rotate(-.9 + swing * 1.5);
        ctx.fillStyle = COL.muted; ctx.fillRect(-3, 0, 6, 34); ctx.fillStyle = COL.amber; ctx.fillRect(-16, -14, 32, 18); ctx.fillStyle = rgba(COL.text, .35); ctx.fillRect(-16, -14, 32, 4);
        ctx.restore();
      }
      if (combo >= 3) txt('COMBO x' + mult() + '  (' + combo + ')', W / 2, H - 20, { font: FD, size: 14, color: COL.amber, alpha: .85 });
      if (st === 'ready') {
        ctx.fillStyle = rgba(COL.ink, .55); ctx.fillRect(0, 0, W, H);
        txt('BUG SMASHER', W / 2, H / 2 - 36, { font: FD, size: 32, color: COL.amber });
        txt('Toca para empezar a aplastar bugs', W / 2, H / 2 + 8, { size: 13 });
      }
      if (st === 'dead' && deadT > .4) banner(W, H, M.lives ? 'SISTEMA COLAPSADO' : '¡SE ACABÓ EL TIEMPO!', COL.amber, [pad5(score) + ' puntos · ' + hits + ' bugs' + (newBest ? ' · nuevo récord' : ''), 'Toca para jugar otra vez']);
    }

    function setMode(id) { M = MODES[id] || MODES.classic; hud.init(['Puntos', 'Récord', M.lives ? 'Vidas' : 'Tiempo']); reset(); }
    return {
      W, H,
      enter: setMode, setMode,
      update, draw,
      down(p) { mx = p.x; my = p.y; strike(p.x, p.y); },
      move(p) { mx = p.x; my = p.y; },
      key(e, down) { if (down && (e.code === 'Space' || e.code === 'KeyR') && (st === 'dead' || st === 'ready')) { if (st === 'dead') { if (deadT > .6) reset(); } else { st = 'play'; started = true; } return true; } return false; },
      state: () => ({ holes: holes.map((h, i) => ({ k: h.k, x: hx(i), y: hy(i), pop: h.pop, hit: h.hit })), score, st, lives, timeLeft }),
      init() { reset(); }
    };
  }
});
