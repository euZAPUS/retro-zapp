/* Cuatro en Línea · contra una IA con minimax (3 niveles) o contra un amigo */
ZAP.register({
  id: 'connect4', name: 'Cuatro en Línea', tag: 'alinea cuatro fichas antes que la IA', genre: 'Versus', color: 'violet', icon: 'connect4',
  metric: { label: 'Racha de victorias', better: 'high', fmt: v => v + (v === 1 ? ' victoria' : ' victorias') },
  modes: [
    { id: 'easy', name: 'IA fácil', desc: 'Mira solo una jugada por delante y a veces se despista.' },
    { id: 'normal', name: 'IA normal', desc: 'Piensa unas cuantas jugadas por delante.' },
    { id: 'hard', name: 'IA experta', desc: 'Busca seis jugadas hacia delante. Mucha suerte.' },
    { id: 'duo', name: 'Dos jugadores', desc: 'Pasa el ratón o el móvil a un amigo. No cuenta para el perfil.' }
  ],
  skins: [{ id: 'classic', name: 'Clásico', lvl: 0 }, { id: 'coin', name: 'Monedas', lvl: 2 }, { id: 'star', name: 'Estrellas', lvl: 4 }, { id: 'gem', name: 'Gemas', lvl: 6 }],
  hint: 'Haz clic o toca una columna para soltar tu ficha (o usa <kbd>←</kbd> <kbd>→</kbd> y <kbd>Espacio</kbd> / <kbd>Enter</kbd>, o los números <kbd>1</kbd>–<kbd>7</kbd>). Gana quien junte cuatro en línea. La racha se acumula con cada victoria seguida.',
  ach: [
    { id: 'c4hard', name: 'Gran maestro', desc: 'Vence a la IA experta', icon: 'connect4', test: (p, r) => !!r && r.game === 'connect4' && r.mode === 'hard' && r.value >= 1 },
    { id: 'c4streak', name: 'Imparable', desc: 'Racha de 3 victorias', icon: 'crown', test: (p, r) => !!r && r.game === 'connect4' && r.value >= 3 }
  ],
  create(K) {
    const { ctx, COL, TAU, clamp, rand, mix, rgba, txt, banner, rr, burst, sfx, hud, addShake, announce, easeOutBounce, FD, cfg } = K;
    const CELL = 64, COLS = 7, ROWS = 6, PAD = 16, TOP = 70, W = COLS * CELL + PAD * 2, H = TOP + ROWS * CELL + PAD;
    const DEPTH = { easy: 1, normal: 4, hard: 6 };
    const streaks = {};
    let skin = 'classic';
    let mode = 'normal', duo = false, board, turn, st, t = 0, hover = 3, drops, winLine, deadT, result, thinking, newBest, mvCount;

    const pc = who => (who === 1 ? COL.cyan : COL.magenta);
    function reset() {
      board = Array.from({ length: ROWS }, () => Array(COLS).fill(0)); turn = 1; st = 'play'; drops = []; winLine = null; deadT = 0; result = null; thinking = 0; newBest = false; mvCount = 0;
      syncHud();
    }
    function syncHud() {
      if (duo) { hud.set(0, turn === 1 ? 'Cian' : 'Rosa'); hud.set(1, mvCount); }
      else { hud.set(0, st === 'play' ? (turn === 1 ? 'Tú' : 'IA…') : '—'); hud.set(1, streaks[mode] || 0); hud.set(2, K.profile.best() || 0); }
    }
    function dropRow(b, c) { for (let r = ROWS - 1; r >= 0; r--) if (!b[r][c]) return r; return -1; }
    function check(b, who) {
      const D = [[0, 1], [1, 0], [1, 1], [1, -1]];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (b[r][c] !== who) continue;
        for (const [dr, dc] of D) {
          const cells = [[r, c]];
          for (let k = 1; k < 4; k++) { const rr2 = r + dr * k, cc = c + dc * k; if (rr2 < 0 || rr2 >= ROWS || cc < 0 || cc >= COLS || b[rr2][cc] !== who) break; cells.push([rr2, cc]); }
          if (cells.length === 4) return cells;
        }
      }
      return null;
    }
    const full = b => b[0].every(Boolean);
    function place(c) {
      if (st !== 'play') return false;
      const r = dropRow(board, c); if (r < 0) return false;
      board[r][c] = turn; mvCount++;
      drops.push({ r, c, who: turn, t: 0 }); sfx.drip(c);
      const win = check(board, turn);
      if (win) { st = 'anim-end'; winLine = win; result = turn; }
      else if (full(board)) { st = 'anim-end'; result = 0; }
      else turn = 3 - turn;
      syncHud();
      return true;
    }
    function endGame() {
      st = 'dead'; deadT = 0;
      const win = result === 1;
      if (duo) { sfx.win(); K.confetti(null, null, 60); K.profile.submit(null, { duo: true }); announce(result === 0 ? 'Empate' : 'Gana ' + (result === 1 ? 'cian' : 'rosa')); return; }
      if (win) { streaks[mode] = (streaks[mode] || 0) + 1; sfx.win(); K.confetti(null, null, 80); } else { streaks[mode] = 0; sfx.die(); addShake(8); }
      newBest = K.profile.submit(win ? streaks[mode] : 0, { won: win, draw: result === 0 }).isBest;
      announce(result === 0 ? 'Empate' : win ? 'Has ganado' : 'Has perdido');
      syncHud();
    }
    /* ---- IA: minimax con poda alfa-beta ---- */
    function score4(b, who) {
      let s = 0; const opp = 3 - who;
      const win = (cells) => {
        let m = 0, o = 0, e = 0; for (const [r, c] of cells) { const v = b[r][c]; if (v === who) m++; else if (v === opp) o++; else e++; }
        if (m === 4) return 100000; if (o === 4) return -100000;
        if (m === 3 && e === 1) return 60; if (m === 2 && e === 2) return 12;
        if (o === 3 && e === 1) return -70; if (o === 2 && e === 2) return -10;
        return 0;
      };
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (c + 3 < COLS) s += win([0, 1, 2, 3].map(k => [r, c + k]));
        if (r + 3 < ROWS) s += win([0, 1, 2, 3].map(k => [r + k, c]));
        if (r + 3 < ROWS && c + 3 < COLS) s += win([0, 1, 2, 3].map(k => [r + k, c + k]));
        if (r + 3 < ROWS && c - 3 >= 0) s += win([0, 1, 2, 3].map(k => [r + k, c - k]));
      }
      for (let r = 0; r < ROWS; r++) if (b[r][3] === who) s += 6; else if (b[r][3] === opp) s -= 6;
      return s;
    }
    const ORDER = [3, 2, 4, 1, 5, 0, 6];
    function minimax(b, depth, alpha, beta, maxing, who) {
      const opp = 3 - who;
      if (check(b, who)) return 1e6 + depth;
      if (check(b, opp)) return -1e6 - depth;
      if (full(b)) return 0;
      if (depth === 0) return score4(b, who);
      if (maxing) {
        let v = -Infinity;
        for (const c of ORDER) { const r = dropRow(b, c); if (r < 0) continue; b[r][c] = who; v = Math.max(v, minimax(b, depth - 1, alpha, beta, false, who)); b[r][c] = 0; alpha = Math.max(alpha, v); if (alpha >= beta) break; }
        return v;
      }
      let v = Infinity;
      for (const c of ORDER) { const r = dropRow(b, c); if (r < 0) continue; b[r][c] = opp; v = Math.min(v, minimax(b, depth - 1, alpha, beta, true, who)); b[r][c] = 0; beta = Math.min(beta, v); if (alpha >= beta) break; }
      return v;
    }
    function aiMove() {
      const b = board.map(r => r.slice()), depth = DEPTH[mode] || 4, cols = ORDER.filter(c => dropRow(b, c) >= 0);
      if (mode === 'easy' && Math.random() < .3) return cols[(Math.random() * cols.length) | 0];
      let best = cols[0], bv = -Infinity;
      for (const c of cols) {
        const r = dropRow(b, c); b[r][c] = 2;
        const v = minimax(b, depth - 1, -Infinity, Infinity, false, 2) + (mode === 'easy' ? rand(-30, 30) : rand(0, .5));
        b[r][c] = 0;
        if (v > bv) { bv = v; best = c; }
      }
      return best;
    }

    function update(dt) {
      t += dt;
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]; d.t += dt;
        const dur = .18 + d.r * .06;
        if (!d.landed && d.t >= dur) { d.landed = true; burst(PAD + d.c * CELL + CELL / 2, TOP + (d.r + 1) * CELL - 8, 6, pc(d.who), { speed: 100, life: .35, grav: 200, size: 2.5, angle: -Math.PI / 2, spread: 2 }); sfx.hit(); }
        if (d.t > dur + .45) drops.splice(i, 1);
      }
      if (st === 'anim-end' && drops.every(d => d.landed)) endGame();
      if (st === 'dead') deadT += dt;
      if (st === 'play' && !duo && turn === 2 && !drops.some(d => !d.landed)) {
        thinking += dt;
        if (thinking > .45) { thinking = 0; const c = aiMove(); if (c != null) place(c); }
      }
    }

    function disc(x, y, who, a, glow) {
      ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a == null ? 1 : a;
      const col = pc(who), R = CELL / 2 - 8;
      if (glow && !cfg.low) { ctx.shadowColor = col; ctx.shadowBlur = 18; }
      ctx.fillStyle = col; ctx.beginPath();
      if (skin === 'gem') { ctx.moveTo(0, -R - 3); ctx.lineTo(R + 2, 0); ctx.lineTo(0, R + 3); ctx.lineTo(-R - 2, 0); ctx.closePath(); } else ctx.arc(0, 0, R, 0, TAU);
      ctx.fill(); ctx.shadowBlur = 0;
      if (skin === 'coin') { ctx.strokeStyle = rgba(COL.ink, .35); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, R - 6, 0, TAU); ctx.stroke(); txt('$', 0, 2, { font: FD, size: 18, color: rgba(COL.ink, .5) }); }
      else if (skin === 'star') { ctx.fillStyle = rgba(COL.ink, .32); ctx.beginPath(); for (let i = 0; i < 10; i++) { const an = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 6 : 15; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); ctx.fill(); }
      else if (skin === 'gem') { ctx.strokeStyle = rgba(COL.ink, .35); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-R - 2, 0); ctx.lineTo(R + 2, 0); ctx.moveTo(0, -R - 3); ctx.lineTo(-10, 0); ctx.lineTo(0, R + 3); ctx.moveTo(0, -R - 3); ctx.lineTo(10, 0); ctx.lineTo(0, R + 3); ctx.stroke(); }
      else { ctx.fillStyle = rgba(COL.ink, .25); ctx.beginPath(); ctx.arc(0, 0, R - 9, 0, TAU); ctx.fill(); }
      ctx.fillStyle = rgba(COL.text, .3); ctx.beginPath(); ctx.arc(-8, -9, 7, 0, TAU); ctx.fill();
      ctx.restore();
    }
    function draw() {
      ctx.fillStyle = COL.ink; ctx.fillRect(-20, -20, W + 40, H + 40);
      // ficha en espera sobre la columna
      if ((st === 'play') && (duo || turn === 1) && !drops.some(d => !d.landed)) {
        const x = PAD + hover * CELL + CELL / 2, bob = Math.sin(t * 6) * 3;
        disc(x, TOP - CELL / 2 + 6 + bob, turn, .85, true);
        ctx.fillStyle = rgba(pc(turn), .1); ctx.fillRect(PAD + hover * CELL, TOP, CELL, ROWS * CELL);
      }
      // fichas
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const who = board[r][c]; if (!who) continue;
        const d = drops.find(q => q.r === r && q.c === c && !q.landed2);
        let y = TOP + r * CELL + CELL / 2;
        if (d) { const dur = .18 + r * .06, q = clamp(d.t / dur, 0, 1); const tgt = y, start = TOP - CELL / 2; y = start + (tgt - start) * (q < 1 ? q * q : 1); if (q >= 1) y += (1 - easeOutBounce(clamp((d.t - dur) / .4, 0, 1))) * -10; }
        const isWin = winLine && winLine.some(([wr, wc]) => wr === r && wc === c);
        disc(PAD + c * CELL + CELL / 2, y, who, 1, isWin ? Math.sin(t * 10) > -.2 : false);
        if (isWin && st !== 'play') { ctx.strokeStyle = rgba(COL.text, .6 + .4 * Math.sin(t * 10)); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(PAD + c * CELL + CELL / 2, TOP + r * CELL + CELL / 2, CELL / 2 - 4, 0, TAU); ctx.stroke(); }
      }
      // tablero (agujeros)
      ctx.fillStyle = mix(COL.panel, COL.violet, .22);
      ctx.beginPath(); ctx.rect(PAD - 6, TOP - 2, COLS * CELL + 12, ROWS * CELL + 8);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { ctx.moveTo(PAD + c * CELL + CELL / 2 + CELL / 2 - 6, TOP + r * CELL + CELL / 2); ctx.arc(PAD + c * CELL + CELL / 2, TOP + r * CELL + CELL / 2, CELL / 2 - 6, 0, TAU, true); }
      ctx.fill('evenodd');
      ctx.strokeStyle = rgba(COL.violet, .6); ctx.lineWidth = 2; ctx.strokeRect(PAD - 6, TOP - 2, COLS * CELL + 12, ROWS * CELL + 8);
      ctx.fillStyle = rgba(COL.ink, .35);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { ctx.strokeStyle = rgba(COL.ink, .5); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(PAD + c * CELL + CELL / 2, TOP + r * CELL + CELL / 2, CELL / 2 - 6, 0, TAU); ctx.stroke(); }
      if (!duo && st === 'play' && turn === 2) txt('La IA piensa' + '.'.repeat(1 + Math.floor(t * 3) % 3), W / 2, 30, { size: 13, color: COL.magenta });
      if (st === 'play' && (duo || turn === 1)) txt(duo ? 'Turno de ' + (turn === 1 ? 'cian' : 'rosa') : 'Tu turno', W / 2, 18, { size: 12, color: pc(turn), alpha: .9 });
      if (st === 'dead' && deadT > .5) {
        if (duo) banner(W, H, result === 0 ? 'EMPATE' : (result === 1 ? 'GANA CIAN' : 'GANA ROSA'), result === 0 ? COL.amber : pc(result), ['Toca para jugar otra vez']);
        else banner(W, H, result === 0 ? 'EMPATE' : result === 1 ? '¡VICTORIA!' : 'DERROTA', result === 1 ? COL.lime : result === 0 ? COL.amber : COL.magenta, [result === 1 ? 'Racha de ' + (streaks[mode] || 0) + (newBest ? ' · nuevo récord' : '') : 'La racha vuelve a 0', 'Toca para jugar otra vez']);
      }
    }

    function colAt(p) { const c = Math.floor((p.x - PAD) / CELL); return c < 0 || c >= COLS ? -1 : c; }
    function play(c) {
      if (st === 'dead') { if (deadT > .5) reset(); return; }
      if (st !== 'play' || (!duo && turn !== 1) || drops.some(d => !d.landed)) return;
      place(c);
    }
    function setMode(id) { mode = ['easy', 'normal', 'hard', 'duo'].includes(id) ? id : 'normal'; duo = mode === 'duo'; hud.init(duo ? ['Turno', 'Fichas'] : ['Turno', 'Racha', 'Récord']); reset(); }
    return {
      W, H,
      enter: setMode, setMode,
      update, draw,
      down(p) { const c = colAt(p); if (c >= 0) hover = c; if (st === 'dead') { play(0); return; } if (c >= 0) play(c); },
      move(p) { const c = colAt(p); if (c >= 0) hover = c; },
      controls(el) {
        K.pad.buttons(el, [
          { label: '◀', cls: 'sq', down: () => { hover = Math.max(0, hover - 1); } },
          { label: 'SOLTAR', down: () => play(hover) },
          { label: '▶', cls: 'sq', down: () => { hover = Math.min(COLS - 1, hover + 1); } }
        ]);
      },
      key(e, down) {
        if (!down) return ['ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'ArrowDown'].includes(e.code);
        const c = e.code;
        if (c === 'ArrowLeft' || c === 'KeyA') { hover = Math.max(0, hover - 1); return true; }
        if (c === 'ArrowRight' || c === 'KeyD') { hover = Math.min(COLS - 1, hover + 1); return true; }
        if (c === 'Space' || c === 'Enter' || c === 'ArrowDown') { if (!e.repeat) play(hover); return true; }
        if (/^Digit[1-7]$/.test(c)) { hover = +c.slice(5) - 1; if (!e.repeat) play(hover); return true; }
        return false;
      },
      state: () => ({ board: board.map(r => r.slice()), turn, st, result, mode }),
      setSkin(id) { skin = id; K.redraw(); },
      init() { reset(); }
    };
  }
});
