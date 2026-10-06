/* Simon Zap · repite la secuencia de luces y sonidos */
ZAP.register({
  id: 'simon', name: 'Simon Zap', tag: 'repite la secuencia de luces', genre: 'Reflejos', color: 'magenta', icon: 'simon',
  modes: [
    { id: 'classic', name: 'Clásico', desc: 'Repite la secuencia. Cada ronda añade un color.' },
    { id: 'reverse', name: 'Inverso', desc: 'Repite la secuencia al revés, del último al primero.' },
    { id: 'fast', name: 'Turbo', desc: 'La secuencia suena al doble de velocidad.' },
    { id: 'random', name: 'Aleatorio', desc: 'Cada ronda es una secuencia completamente nueva.' }
  ],
  metric: { label: 'Rondas', better: 'high', fmt: v => v + (v === 1 ? ' ronda' : ' rondas') },
  hint: 'Mira la secuencia y repítela con el ratón, el dedo o las teclas <kbd>Q</kbd> <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> (o <kbd>1</kbd>–<kbd>4</kbd>), que siguen la posición de cada color.',
  ach: [
    { id: 'simon10', name: 'Oído absoluto', desc: 'Llega a la ronda 10 en Simon Zap', icon: 'simon', test: (p, r) => !!r && r.game === 'simon' && r.value >= 10 },
    { id: 'simonrev', name: 'Al revés', desc: 'Ronda 7 en modo Inverso', icon: 'star', test: (p, r) => !!r && r.game === 'simon' && r.mode === 'reverse' && r.value >= 7 }
  ],
  create(K) {
    const { ctx, COL, TAU, clamp, rand, mix, rgba, txt, banner, burst, sfx, hud, addShake, announce, FD, cfg } = K;
    const W = 420, H = 420, CX = 210, CY = 210, RO = 192, RI = 74, GAPA = .07;
    const KEYS = { KeyQ: 0, Digit1: 0, KeyW: 1, Digit2: 1, KeyA: 2, Digit3: 2, KeyS: 3, Digit4: 3 };
    const QUAD = [[Math.PI, 1.5 * Math.PI], [1.5 * Math.PI, 2 * Math.PI], [.5 * Math.PI, Math.PI], [0, .5 * Math.PI]];
    const pc = () => [COL.cyan, COL.magenta, COL.amber, COL.lime];
    let mode = 'classic', st, t = 0, seq, idx, round, score, lit, litT, showI, showT, phase, waitT, ripples, deadT, newBest, hover = -1, msgT;

    function reset() { st = 'ready'; seq = []; idx = 0; round = 0; score = 0; lit = -1; litT = 0; showI = 0; showT = 0; phase = 'idle'; waitT = 0; ripples = []; deadT = 0; newBest = false; msgT = 0; }
    function tempo() { return mode === 'fast' ? { on: Math.max(.1, .26 - round * .008), gap: .08 } : { on: Math.max(.2, .46 - round * .012), gap: .16 }; }
    function newRound() {
      round++;
      if (mode === 'random') { seq = Array.from({ length: round }, () => (Math.random() * 4) | 0); } else seq.push((Math.random() * 4) | 0);
      st = 'show'; showI = 0; showT = .5; idx = 0; phase = 'gap';
      hud.set(0, round, true);
    }
    const expected = () => (mode === 'reverse' ? seq[seq.length - 1 - idx] : seq[idx]);
    function light(i, dur) { lit = i; litT = dur; sfx.note(i, Math.max(.15, dur)); const a = (QUAD[i][0] + QUAD[i][1]) / 2; ripples.push({ i, t: 0 }); burst(CX + Math.cos(a) * 130, CY + Math.sin(a) * 130, 8, pc()[i], { speed: 160, life: .5, grav: 80, size: 3 }); }
    function press(i) {
      if (st === 'dead') { if (deadT > .6) reset(); return; }
      if (st === 'ready') { newRound(); return; }
      if (st !== 'input') return;
      if (i === expected()) {
        light(i, .22); idx++;
        if (idx >= seq.length) {
          score = round; st = 'wait'; waitT = .8; sfx.point(); K.popText(CX, CY - 4, '¡BIEN!', COL.lime, { size: 20 }); hud.set(1, K.profile.best() || 0);
        }
      } else fail(i);
    }
    function fail(i) {
      st = 'dead'; deadT = 0; addShake(10); sfx.die(); lit = i; litT = .5;
      burst(CX, CY, 30, COL.magenta, { speed: 300, life: .8, grav: 400, size: 3.5 });
      newBest = K.profile.submit(score).isBest;
      announce('Fallaste. Rondas completadas: ' + score);
    }
    function update(dt) {
      t += dt; litT = Math.max(0, litT - dt); if (litT === 0 && st !== 'dead') lit = -1;
      for (let k = ripples.length - 1; k >= 0; k--) { ripples[k].t += dt; if (ripples[k].t > .6) ripples.splice(k, 1); }
      if (st === 'show') {
        showT -= dt;
        if (showT <= 0) {
          const tp = tempo();
          if (phase === 'gap') { if (showI >= seq.length) { st = 'input'; lit = -1; } else { light(seq[showI], tp.on); phase = 'on'; showT = tp.on; } }
          else { lit = -1; showI++; phase = 'gap'; showT = tp.gap; if (showI >= seq.length) { st = 'input'; } }
        }
      } else if (st === 'wait') { waitT -= dt; if (waitT <= 0) newRound(); }
      else if (st === 'dead') deadT += dt;
      hud.set(1, K.profile.best() || 0);
    }

    function wedge(i, r0, r1, col) {
      const [a0, a1] = QUAD[i];
      ctx.beginPath(); ctx.arc(CX, CY, r1, a0 + GAPA, a1 - GAPA); ctx.arc(CX, CY, r0, a1 - GAPA * 2.2, a0 + GAPA * 2.2, true); ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
    }
    function draw() {
      ctx.fillStyle = COL.ink; ctx.fillRect(-20, -20, W + 40, H + 40);
      const C = pc();
      for (let i = 0; i < 4; i++) {
        const on = lit === i, base = mix(COL.ink, C[i], .3);
        ctx.save();
        if (on) { ctx.translate(CX, CY); ctx.scale(1.03, 1.03); ctx.translate(-CX, -CY); if (!cfg.low) { ctx.shadowColor = C[i]; ctx.shadowBlur = 34; } }
        wedge(i, RI, RO, on ? mix(C[i], COL.text, .25) : hover === i && st === 'input' ? mix(base, C[i], .35) : base);
        ctx.restore();
        ctx.strokeStyle = rgba(C[i], on ? 1 : .55); ctx.lineWidth = 2;
        const [a0, a1] = QUAD[i]; ctx.beginPath(); ctx.arc(CX, CY, RO, a0 + GAPA, a1 - GAPA); ctx.stroke();
        const a = (a0 + a1) / 2; txt(['Q', 'W', 'A', 'S'][i], CX + Math.cos(a) * 138, CY + Math.sin(a) * 138, { font: FD, size: 16, color: COL.ink, alpha: on ? .8 : .35 });
      }
      for (const r of ripples) { const q = r.t / .6, a = (QUAD[r.i][0] + QUAD[r.i][1]) / 2; ctx.strokeStyle = rgba(C[r.i], 1 - q); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(CX + Math.cos(a) * 130, CY + Math.sin(a) * 130, 10 + q * 60, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = mix(COL.ink, COL.panel, .8); ctx.beginPath(); ctx.arc(CX, CY, RI - 8, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(COL.text, .2); ctx.lineWidth = 2; ctx.stroke();
      if (st === 'ready') { txt('SIMON', CX, CY - 10, { font: FD, size: 22, color: COL.magenta }); txt('toca', CX, CY + 16, { size: 12, color: COL.muted }); }
      else { txt(String(Math.max(1, round)), CX, CY - 8, { font: FD, size: 30, color: COL.amber }); txt(st === 'show' ? 'MIRA' : st === 'input' ? 'TU TURNO' : st === 'dead' ? 'FALLO' : 'BIEN', CX, CY + 22, { size: 10, color: st === 'input' ? COL.lime : COL.muted }); }
      if (st === 'dead' && deadT > .5) banner(W, H, 'FALLASTE', COL.magenta, [score + (score === 1 ? ' ronda' : ' rondas') + (newBest ? ' · nuevo récord' : ''), 'Toca o pulsa una tecla para reintentar']);
    }

    function padAt(p) {
      const dx = p.x - CX, dy = p.y - CY, r = Math.hypot(dx, dy);
      if (r < RI - 4 || r > RO + 6) return -1;
      return dy < 0 ? (dx < 0 ? 0 : 1) : (dx < 0 ? 2 : 3);
    }
    function setMode(id) { mode = ['classic', 'reverse', 'fast', 'random'].includes(id) ? id : 'classic'; reset(); hud.set(0, 0); }
    return {
      W, H,
      enter(id) { hud.init(['Ronda', 'Récord']); setMode(id); },
      setMode,
      update, draw,
      down(p) { const i = padAt(p); if (st === 'dead' || st === 'ready') { press(i); return; } if (i >= 0) press(i); },
      move(p) { const h = padAt(p); if (h !== hover) hover = h; },
      leaveCanvas() { hover = -1; },
      controls(el) {
        K.pad.buttons(el, [0, 1, 2, 3].map(i => ({ label: ['CIAN', 'ROSA', 'ÁMBAR', 'LIMA'][i], down: () => press(i) })));
      },
      key(e, down) {
        if (!(e.code in KEYS)) { if (down && e.code === 'Space') { if (st === 'ready' || st === 'dead') press(-1); return true; } return false; }
        if (down && !e.repeat) press(KEYS[e.code]);
        return true;
      },
      state: () => ({ seq: seq.slice(), idx, st, round, mode, score }),
      init() { reset(); }
    };
  }
});
