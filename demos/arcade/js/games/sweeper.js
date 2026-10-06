/* Zero-Day Sweeper · buscaminas con cuatro dificultades */
ZAP.register({
  id: 'sweeper', name: 'Zero-Day Sweeper', tag: 'busca los exploits sin pisarlos', genre: 'Puzzle', color: 'magenta', icon: 'sweeper',
  metric: { label: 'Tiempo', better: 'low', fmt: v => ZAP.fmtTime(v) },
  modes: [
    { id: 'facil', name: 'Fácil 9×9', desc: '10 minas. Para calentar.' },
    { id: 'medio', name: 'Medio 12×12', desc: '24 minas.' },
    { id: 'dificil', name: 'Difícil 14×14', desc: '38 minas.' },
    { id: 'experto', name: 'Experto 18×14', desc: '60 minas. Sin margen de error.' }
  ],
  hint: 'Clic para descubrir. Clic derecho o mantener pulsado para marcar con parche. Clic en un número con sus parches puestos abre el resto de casillas de alrededor. El primer clic siempre es seguro. Atajos: <kbd>R</kbd> reinicia, <kbd>F</kbd> modo bandera, <kbd>1</kbd>–<kbd>4</kbd> dificultad.',
  ach: [
    { id: 'swhard', name: 'Desactivador', desc: 'Gana en Difícil o Experto', icon: 'sweeper', test: (p, r) => !!r && r.game === 'sweeper' && r.value != null && (r.mode === 'dificil' || r.mode === 'experto') },
    { id: 'swfast', name: 'Manos rápidas', desc: 'Gana el modo Fácil en 20 s o menos', icon: 'bolt', test: (p, r) => !!r && r.game === 'sweeper' && r.mode === 'facil' && r.value != null && r.value <= 20 }
  ],
  create(K) {
    const { ctx, COL, TAU, clamp, rand, mix, rgba, txt, burst, sfx, hud, addShake, announce, easeOutBack, easeOutBounce, FD, $$ } = K;
    const LV = { facil: { c: 9, r: 9, m: 10 }, medio: { c: 12, r: 12, m: 24 }, dificil: { c: 14, r: 14, m: 38 }, experto: { c: 18, r: 14, m: 60 } };
    const IDS = ['facil', 'medio', 'dificil', 'experto'];
    let NUMC, UP, UP_HI, UP_LO, UP_HOVER, DOWN;
    function recolor() {
      NUMC = [COL.cyan, COL.lime, COL.amber, COL.violet, COL.magenta, mix(COL.cyan, COL.lime, .5), mix(COL.amber, COL.magenta, .5), COL.text];
      UP = mix(COL.panel, COL.text, .1); UP_HI = mix(UP, COL.text, .14); UP_LO = mix(UP, COL.ink, .55);
      UP_HOVER = mix(UP, COL.cyan, .2); DOWN = mix(COL.ink, COL.panel, .55);
    }
    recolor();
    let mode = 'facil';
    let c, r, m, N, cell, W = 360, H = 360;
    let mine, num, rev, flag, revT, flagT, boomT, boomDone;
    let st, t = 0, opened, flags, timer, hover = -1, flagMode = false, endT, hitI, placed, lastBoom = 0, lastX = 0, lastY = 0, lp = null, active = false;
    let dirtyUntil = 0, flagBtn = null;
    const dirty = s => { dirtyUntil = Math.max(dirtyUntil, t + s); };

    function nb(i) {
      const x = i % c, y = (i / c) | 0, o = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < c && ny < r) o.push(ny * c + nx);
      }
      return o;
    }
    function syncUI() { if (flagBtn) flagBtn.setAttribute('aria-pressed', String(flagMode)); }
    function newGame() {
      const L = LV[mode];
      c = L.c; r = L.r; m = L.m; N = c * r;
      cell = Math.floor(Math.min(40, 480 / c)); W = c * cell; H = r * cell;
      mine = new Uint8Array(N); num = new Uint8Array(N); rev = new Uint8Array(N); flag = new Uint8Array(N);
      revT = new Float32Array(N); flagT = new Float32Array(N); boomT = new Float32Array(N).fill(-1); boomDone = new Uint8Array(N);
      st = 'ready'; opened = 0; flags = 0; timer = 0; hitI = -1; placed = false; endT = 0; lp = null; hover = -1; dirty(.3);
      if (active) K.sizeCanvas(W, H);
      syncUI();
    }
    function place(safe) {
      const ban = new Set([safe].concat(nb(safe)));
      let n = 0;
      while (n < m) {
        const i = (Math.random() * N) | 0;
        if (mine[i] || ban.has(i)) continue;
        mine[i] = 1; n++;
      }
      for (let i = 0; i < N; i++) if (!mine[i]) num[i] = nb(i).reduce((a, j) => a + mine[j], 0);
      placed = true;
    }
    function open(start) {
      const q = [start], d = new Int16Array(N);
      rev[start] = 1; revT[start] = t; let head = 0, maxD = 0;
      while (head < q.length) {
        const i = q[head++]; opened++;
        if (num[i] === 0) {
          for (const j of nb(i)) {
            if (!rev[j] && !flag[j] && !mine[j]) { rev[j] = 1; d[j] = d[i] + 1; if (d[j] > maxD) maxD = d[j]; revT[j] = t + d[j] * .04; q.push(j); }
          }
        }
      }
      dirty(maxD * .04 + .4);
      if (q.length > 6) sfx.cascade(); else sfx.reveal();
    }
    function reveal(i) {
      if (st === 'won' || st === 'lost' || rev[i] || flag[i]) return;
      lastX = (i % c) * cell + cell / 2; lastY = ((i / c) | 0) * cell + cell / 2;
      if (!placed) { place(i); st = 'play'; timer = 0; }
      if (mine[i]) { lose(i); return; }
      open(i); checkWin();
    }
    function toggleFlag(i) {
      if (st === 'won' || st === 'lost' || rev[i]) return;
      flag[i] ^= 1; flags += flag[i] ? 1 : -1; flagT[i] = t; dirty(.5); sfx.flag();
    }
    function chord(i) {
      if (!rev[i] || !num[i] || st === 'won' || st === 'lost') return;
      const ns = nb(i);
      if (ns.reduce((a, j) => a + flag[j], 0) !== num[i]) return;
      for (const j of ns) { if (!rev[j] && !flag[j]) { reveal(j); if (st === 'lost') break; } }
    }
    function lose(i) {
      st = 'lost'; endT = t; hitI = i; dirty(3.5);
      const x0 = i % c, y0 = (i / c) | 0;
      for (let j = 0; j < N; j++) {
        if (!mine[j]) continue;
        boomT[j] = j === i ? t : t + .15 + Math.hypot((j % c) - x0, ((j / c) | 0) - y0) * .07;
      }
      K.profile.submit(null, { lost: true });
      announce('Exploit activado. Has perdido.');
    }
    function checkWin() {
      if (opened !== N - m || st !== 'play') return;
      st = 'won'; endT = t; dirty(3.5);
      for (let j = 0; j < N; j++) if (mine[j] && !flag[j]) { flag[j] = 1; flagT[j] = t; }
      flags = m;
      sfx.win();
      const secs = Math.max(1, Math.round(timer));
      K.profile.submit(secs);
      announce('Sistema asegurado en ' + secs + ' segundos.');
    }

    function update(dt) {
      t += dt;
      if (st === 'play') timer += dt;
      if (st === 'lost') {
        for (let j = 0; j < N; j++) {
          if (mine[j] && !boomDone[j] && boomT[j] >= 0 && t >= boomT[j]) {
            boomDone[j] = 1;
            const x = (j % c) * cell + cell / 2, y = ((j / c) | 0) * cell + cell / 2;
            burst(x, y, 12, j === hitI ? COL.amber : COL.magenta, { speed: 200, life: .7, grav: 300, size: 3.5 });
            addShake(j === hitI ? 9 : 4);
            if (t - lastBoom > .08) { if (j === hitI) sfx.boom(); else sfx.pop(); lastBoom = t; }
          }
        }
      }
      if (st === 'won' && t - endT < 1.4 && Math.random() < dt * 22) {
        burst(rand(0, W), rand(H * .2, H * .8), 10, [COL.lime, COL.cyan, COL.amber, COL.violet][(Math.random() * 4) | 0], { speed: 260, life: 1, grav: 380, size: 3.5 });
      }
      const b = K.profile.best();
      hud.set(0, m - flags, true); hud.set(1, Math.floor(timer) + ' s'); hud.set(2, b != null ? b + ' s' : '--');
    }

    function drawUp(x, y, hv) {
      const pd = 1.5, w = cell - pd * 2;
      ctx.fillStyle = hv ? UP_HOVER : UP; ctx.fillRect(x + pd, y + pd, w, w);
      ctx.fillStyle = UP_HI; ctx.fillRect(x + pd, y + pd, w, 2);
      ctx.fillStyle = UP_LO; ctx.fillRect(x + pd, y + cell - pd - 2, w, 2);
      if (hv) { ctx.strokeStyle = rgba(COL.cyan, .8); ctx.lineWidth = 1.5; ctx.strokeRect(x + pd + .75, y + pd + .75, w - 1.5, w - 1.5); }
    }
    function drawFlag(cx, cy, ft) {
      const q = clamp((t - ft) / .35, 0, 1), off = (1 - easeOutBounce(q)) * -16;
      ctx.globalAlpha = Math.min(1, q * 4);
      ctx.fillStyle = COL.text; ctx.fillRect(cx - 1.2, cy - cell * .26 + off, 2.4, cell * .5);
      ctx.fillStyle = COL.amber;
      ctx.beginPath(); ctx.moveTo(cx + 1.2, cy - cell * .26 + off); ctx.lineTo(cx + cell * .27, cy - cell * .14 + off); ctx.lineTo(cx + 1.2, cy - cell * .02 + off); ctx.fill();
      ctx.fillStyle = COL.muted; ctx.fillRect(cx - cell * .16, cy + cell * .22 + off, cell * .32, 3);
      ctx.globalAlpha = 1;
    }
    function drawMine(cx, cy, hit) {
      const rad = cell * .2, col = hit ? COL.amber : COL.magenta;
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k < 8; k++) { const a = k * TAU / 8; ctx.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); ctx.lineTo(cx + Math.cos(a) * rad * 1.65, cy + Math.sin(a) * rad * 1.65); }
      ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.fill();
      ctx.fillStyle = COL.text; ctx.fillRect(cx - rad * .5, cy - rad * .5, rad * .4, rad * .4);
    }

    function draw() {
      ctx.fillStyle = COL.ink; ctx.fillRect(-20, -20, W + 40, H + 40);
      const over = st === 'won' || st === 'lost', fs = Math.floor(cell * .52);
      for (let i = 0; i < N; i++) {
        const x = (i % c) * cell, y = ((i / c) | 0) * cell, cx = x + cell / 2, cy = y + cell / 2, h2 = cell / 2 - 1.5;
        const shown = rev[i] && t >= revT[i];
        if (shown) {
          const p = clamp((t - revT[i]) / .22, 0, 1);
          if (p < 1) drawUp(x, y, false);
          const s = p < 1 ? Math.max(.01, easeOutBack(p)) : 1;
          ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
          ctx.fillStyle = DOWN; ctx.fillRect(-h2, -h2, h2 * 2, h2 * 2);
          if (p < 1) { ctx.fillStyle = rgba(COL.cyan, (1 - p) * .35); ctx.fillRect(-h2, -h2, h2 * 2, h2 * 2); }
          if (num[i] > 0) txt(String(num[i]), 0, 1, { w: '800', size: fs, color: NUMC[num[i] - 1] });
          ctx.restore();
        } else if (mine[i] && boomDone[i]) {
          const hit = i === hitI, age = t - boomT[i];
          ctx.fillStyle = mix(COL.magenta, COL.ink, hit ? .4 : .66); ctx.fillRect(x + 1.5, y + 1.5, cell - 3, cell - 3);
          drawMine(cx, cy, hit);
          if (age < .45) { ctx.strokeStyle = rgba(COL.amber, 1 - age / .45); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, age * cell * 3.4, 0, TAU); ctx.stroke(); }
        } else {
          drawUp(x, y, hover === i && !over);
          if (flag[i]) drawFlag(cx, cy, flagT[i]);
          if (st === 'lost' && flag[i] && !mine[i] && t - endT > .3) {
            ctx.strokeStyle = COL.magenta; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(cx - cell * .25, cy - cell * .25); ctx.lineTo(cx + cell * .25, cy + cell * .25); ctx.moveTo(cx + cell * .25, cy - cell * .25); ctx.lineTo(cx - cell * .25, cy + cell * .25); ctx.stroke();
          }
        }
      }
      if (st === 'won') {
        const a = t - endT;
        if (a < 1.4) { ctx.strokeStyle = rgba(COL.lime, 1 - a / 1.4); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(lastX, lastY, a * 420, 0, TAU); ctx.stroke(); }
      }
      if (over && t - endT > 1) {
        const by = H - 48, col = st === 'won' ? COL.lime : COL.magenta;
        ctx.fillStyle = rgba(COL.ink, .88); ctx.fillRect(0, by, W, 48);
        ctx.fillStyle = col; ctx.fillRect(0, by, W, 2);
        txt(st === 'won' ? 'SISTEMA ASEGURADO · ' + Math.round(timer) + ' s' : 'EXPLOIT ACTIVADO', W / 2, by + 18, { font: FD, size: 15, color: col });
        txt('Toca o pulsa R para jugar otra vez', W / 2, by + 36, { size: 11, color: COL.muted });
      }
    }

    function idx(p) {
      const x = Math.floor(p.x / cell), y = Math.floor(p.y / cell);
      return x < 0 || y < 0 || x >= c || y >= r ? -1 : y * c + x;
    }
    function cancelLp() { if (lp) { clearTimeout(lp.timer); lp = null; } }
    function setMode(id) { mode = LV[id] ? id : 'facil'; newGame(); }

    return {
      get W() { return W; }, get H() { return H; },
      enter(id) { active = true; hud.init(['Minas', 'Tiempo', 'Récord']); setMode(id); },
      setMode,
      leave() { active = false; cancelLp(); },
      update, draw,
      controls(el) {
        const d = K.pad.buttons(el, [
          { label: 'Modo bandera', cls: 'sm', id: 'flagMode', click: () => { flagMode = !flagMode; syncUI(); } },
          { label: 'Nueva partida', cls: 'sm', click: newGame }
        ], true);
        flagBtn = d.querySelector('#flagMode'); flagBtn.setAttribute('aria-pressed', 'false'); flagBtn.classList.add('toggle'); syncUI();
      },
      down(p, e) {
        const i = idx(p); if (i < 0) return;
        if (e.button === 2) { toggleFlag(i); return; }
        if (e.button === 1) { chord(i); return; }
        if (e.button !== 0) return;
        const L = { i, x: p.x, y: p.y, fired: false };
        L.timer = setTimeout(() => {
          L.fired = true;
          if (st !== 'won' && st !== 'lost') { toggleFlag(i); try { if (navigator.vibrate) navigator.vibrate(15); } catch (_) { /* nada */ } }
        }, 380);
        lp = L;
      },
      move(p) {
        const h = idx(p);
        if (h !== hover) { hover = h; dirty(.08); }
        if (lp && Math.hypot(p.x - lp.x, p.y - lp.y) > 10) cancelLp();
      },
      up(p) {
        if (!lp) return;
        const L = lp; clearTimeout(L.timer); lp = null;
        if (L.fired) return;
        if (st === 'won' || st === 'lost') { if (t - endT > .8) newGame(); return; }
        const i = idx(p); if (i !== L.i) return;
        if (rev[i]) chord(i); else if (flagMode) toggleFlag(i); else reveal(i);
      },
      leaveCanvas() { if (hover !== -1) { hover = -1; dirty(.08); } cancelLp(); },
      cancel() { cancelLp(); },
      idle() { return t >= dirtyUntil; },
      recolor,
      key(e, down) {
        if (!down) return false;
        if (e.code === 'KeyR') { newGame(); return true; }
        if (e.code === 'KeyF') { flagMode = !flagMode; syncUI(); return true; }
        const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
        if (n >= 0) { K.setMode(IDS[n]); return true; }
        return false;
      },
      state: () => ({ st, c, r, m, opened, flags, timer }),
      init() { newGame(); }
    };
  }
});
