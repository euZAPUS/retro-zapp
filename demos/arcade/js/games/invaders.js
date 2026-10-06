/* Zap Invaders · defiende la base de oleadas de invasores */
ZAP.register({
  id: 'invaders', name: 'Zap Invaders', tag: 'frena la invasión pixelada', genre: 'Acción', color: 'lime', icon: 'invaders',
  modes: [
    { id: 'classic', name: 'Clásico', desc: 'Cuatro búnkers, tres vidas y un disparo cada vez.' },
    { id: 'rapid', name: 'Ráfaga', desc: 'Disparo automático al mantener pulsado, pero ellos disparan más.' },
    { id: 'swarm', name: 'Enjambre', desc: 'Más invasores y sin búnkers. Esquiva o muere.' }
  ],
  hint: '<kbd>←</kbd> <kbd>→</kbd> o <kbd>A</kbd> <kbd>D</kbd> para moverte, <kbd>Espacio</kbd> para disparar. En el móvil, arrastra sobre la pantalla (toca para disparar) o usa los botones. Los platillos rojos dan puntos extra.',
  ach: [
    { id: 'inv3', name: 'Defensor', desc: 'Supera 3 oleadas en Zap Invaders', icon: 'invaders', test: (p, r) => !!r && r.game === 'invaders' && r.extra && r.extra.wave >= 4 },
    { id: 'invufo', name: 'Cazaplatillos', desc: 'Derriba un platillo', icon: 'star', manual: true }
  ],
  create(K) {
    const { ctx, COL, TAU, clamp, rand, randInt, mix, rgba, txt, banner, rr, burst, sfx, hud, pad5, addShake, announce, FD, cfg } = K;
    const W = 480, H = 540, SY = H - 46, SW = 34, PS = 3, AW = 9 * PS, AH = 7 * PS, DX = 40, DY = 32;
    const SPR = [
      [['..#...#..', '...#.#...', '..#####..', '.##.#.##.', '#########', '#.#####.#', '#.#...#.#'], ['..#...#..', '#..#.#..#', '#.#####.#', '###.#.###', '#########', '.#######.', '..#...#..']],
      [['..#####..', '.#######.', '##.###.##', '#########', '..#...#..', '.#.###.#.', '#.#...#.#'], ['..#####..', '.#######.', '##.###.##', '#########', '.#.###.#.', '#.#...#.#', '.#.....#.']],
      [['...###...', '.#######.', '#########', '###.#.###', '#########', '..#.#.#..', '.#.....#.'], ['...###...', '.#######.', '#########', '###.#.###', '#########', '.#.#.#.#.', '#.......#']]
    ];
    const MODES = {
      classic: { cols: 9, rows: 4, base: 36, shields: true, fire: 1, auto: false },
      rapid: { cols: 9, rows: 4, base: 42, shields: true, fire: .6, auto: true },
      swarm: { cols: 11, rows: 5, base: 40, shields: false, fire: .75, auto: false }
    };
    let M = MODES.classic;
    let st, t = 0, ship, aliens, gx, gy, dir, frame, frameT, pb, ab, shields, ufo, ufoT, fireT, score, lives, wave, total, alive, deadT, newBest, invuln, shootCd, waveT, keys = { l: false, r: false, f: false }, holding = false;
    const sprCol = ty => [COL.cyan, COL.lime, COL.violet][ty];

    function buildWave() {
      aliens = [];
      for (let r = 0; r < M.rows; r++) for (let c = 0; c < M.cols; c++) aliens.push({ c, r, ty: r === 0 ? 2 : r < 3 ? 1 : 0, alive: true });
      total = aliens.length; alive = total;
      gx = (W - ((M.cols - 1) * DX + AW)) / 2; gy = 72 + Math.min(wave, 5) * 10; dir = 1; frame = 0; frameT = 0; pb = []; ab = []; fireT = 1;
      if (M.shields && (!shields || wave % 3 === 0)) buildShields();
    }
    function buildShields() {
      shields = [];
      const shape = ['..#######..', '.#########.', '###########', '###########', '###########', '###...#####'.replace('...', '...'), '##.......##'];
      for (let i = 0; i < 4; i++) {
        const cells = shape.map(r => r.split('').map(ch => ch === '#'));
        shields.push({ x: 45 + i * 112, y: SY - 92, cells });
      }
    }
    function reset() {
      st = 'ready'; wave = 0; score = 0; lives = 3; deadT = 0; newBest = false; invuln = 0; shootCd = 0; ufo = null; ufoT = rand(12, 20); waveT = 0; shields = null;
      ship = { x: W / 2, tx: W / 2 };
      buildWave(); syncHud();
    }
    function syncHud() { hud.set(0, pad5(score), true); hud.set(1, pad5(K.profile.best() || 0)); hud.set(2, '♥'.repeat(Math.max(0, lives))); hud.set(3, wave + 1); }
    const pos = a => ({ x: gx + a.c * DX, y: gy + a.r * DY });

    function fire() {
      if (st === 'dead') { if (deadT > .6) reset(); return; }
      if (st === 'ready') st = 'play';
      if (st !== 'play' || shootCd > 0) return;
      if (!M.auto && pb.length >= 1) return;
      if (M.auto && pb.length >= 4) return;
      pb.push({ x: ship.x, y: SY - 16 }); shootCd = M.auto ? .16 : .3; sfx.laser();
    }
    function hitShield(b, w, h) {
      for (const s of shields || []) {
        if (b.x < s.x - 3 || b.x > s.x + 11 * 5 + 3 || b.y < s.y - 3 || b.y > s.y + 7 * 5 + 3) continue;
        for (let r = 0; r < 7; r++) for (let c = 0; c < 11; c++) {
          if (!s.cells[r][c]) continue;
          const cx = s.x + c * 5, cy = s.y + r * 5;
          if (b.x + w / 2 > cx && b.x - w / 2 < cx + 5 && b.y + h / 2 > cy && b.y - h / 2 < cy + 5) {
            s.cells[r][c] = false;
            for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (Math.random() < .45 && s.cells[r + dr] && s.cells[r + dr][c + dc]) s.cells[r + dr][c + dc] = false;
            burst(cx + 2, cy + 2, 4, COL.lime, { speed: 90, life: .4, grav: 200, size: 2 });
            return true;
          }
        }
      }
      return false;
    }
    function hurt() {
      if (invuln > 0) return;
      lives--; invuln = 1.6; addShake(10); sfx.explode(); syncHud();
      burst(ship.x, SY, 30, COL.cyan, { speed: 300, life: .9, grav: 400, size: 3.5 }); burst(ship.x, SY, 14, COL.magenta, { speed: 200, life: .7, grav: 300, size: 3 });
      if (lives <= 0) gameOver();
    }
    function gameOver() {
      st = 'dead'; deadT = 0;
      newBest = K.profile.submit(score, { wave: wave + 1 }).isBest;
      announce('Invasión consumada. ' + score + ' puntos.');
    }

    function update(dt) {
      t += dt; shootCd = Math.max(0, shootCd - dt); invuln = Math.max(0, invuln - dt);
      const k = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
      if (k) ship.tx = clamp(ship.tx + k * 340 * dt, SW / 2, W - SW / 2);
      ship.x += (ship.tx - ship.x) * Math.min(1, dt * 18);
      if (st === 'play' && (keys.f || (M.auto && holding))) fire();
      if (st === 'dead') { deadT += dt; return; }
      if (st !== 'play') return;
      if (waveT > 0) { waveT -= dt; if (waveT <= 0) { wave++; buildWave(); syncHud(); } return; }
      const speed = (M.base + wave * 4) * (1 + (1 - alive / total) * 2.4);
      frameT += dt * speed / 36; if (frameT >= 1) { frameT = 0; frame ^= 1; }
      let minC = 99, maxC = -1, lowY = 0;
      for (const a of aliens) if (a.alive) { minC = Math.min(minC, a.c); maxC = Math.max(maxC, a.c); lowY = Math.max(lowY, gy + a.r * DY + AH); }
      gx += dir * speed * dt;
      if ((dir > 0 && gx + maxC * DX + AW > W - 8) || (dir < 0 && gx + minC * DX < 8)) { dir = -dir; gy += 14; sfx.turn(); }
      if (lowY >= SY - 16) { lives = 0; gameOver(); return; }
      // disparos enemigos
      fireT -= dt;
      if (fireT <= 0 && ab.length < 4 + wave) {
        fireT = rand(.45, 1.1) * M.fire / (1 + wave * .08);
        const cols = {}; for (const a of aliens) if (a.alive && (!cols[a.c] || a.r > cols[a.c].r)) cols[a.c] = a;
        const list = Object.values(cols);
        if (list.length) { const a = list[(Math.random() * list.length) | 0], p = pos(a); ab.push({ x: p.x + AW / 2, y: p.y + AH, v: 170 + wave * 12 + (M === MODES.rapid ? 40 : 0), ph: rand(0, TAU) }); }
      }
      for (let i = pb.length - 1; i >= 0; i--) {
        const b = pb[i]; b.y -= 560 * dt; let gone = b.y < 0;
        if (!gone && shields && hitShield(b, 3, 10)) gone = true;
        if (!gone) for (const a of aliens) {
          if (!a.alive) continue; const p = pos(a);
          if (b.x > p.x - 2 && b.x < p.x + AW + 2 && b.y > p.y && b.y < p.y + AH) {
            a.alive = false; alive--; gone = true; const pts = [10, 20, 30][a.ty]; score += pts; syncHud(); sfx.explode();
            burst(p.x + AW / 2, p.y + AH / 2, 14, sprCol(a.ty), { speed: 200, life: .6, grav: 300, size: 3.5 });
            K.popText(p.x + AW / 2, p.y - 6, '+' + pts, sprCol(a.ty), { size: 11 });
            break;
          }
        }
        if (!gone && ufo && b.x > ufo.x && b.x < ufo.x + 34 && b.y > 36 && b.y < 52) {
          const pts = [50, 100, 150, 300][randInt(0, 3)]; score += pts; gone = true; syncHud(); sfx.bonus(); K.profile.unlock('invufo');
          burst(ufo.x + 17, 44, 24, COL.magenta, { speed: 260, life: .8, grav: 200, size: 3.5 }); K.popText(ufo.x + 17, 30, '+' + pts, COL.amber, { size: 16 }); ufo = null;
        }
        if (gone) pb.splice(i, 1);
      }
      if (alive <= 0 && st === 'play') { waveT = 1.4; sfx.win(); K.popText(W / 2, H / 2, 'OLEADA ' + (wave + 1) + ' SUPERADA', COL.lime, { size: 20, life: 1.3 }); score += 50 * (wave + 1); syncHud(); return; }
      for (let i = ab.length - 1; i >= 0; i--) {
        const b = ab[i]; b.y += b.v * dt; b.ph += dt * 14; let gone = b.y > H;
        if (!gone && shields && hitShield(b, 4, 10)) gone = true;
        if (!gone && b.y > SY - 12 && b.y < SY + 14 && Math.abs(b.x - ship.x) < SW / 2 - 2) { gone = true; hurt(); }
        if (gone) ab.splice(i, 1);
      }
      ufoT -= dt;
      if (ufoT <= 0 && !ufo) { ufo = { x: -40, v: 90 + wave * 6, dir: 1 }; if (Math.random() < .5) { ufo.x = W + 6; ufo.dir = -1; } ufoT = rand(14, 24); }
      if (ufo) { ufo.x += ufo.dir * ufo.v * dt; if (ufo.x < -50 || ufo.x > W + 50) ufo = null; }
      hud.set(1, pad5(K.profile.best() || 0));
    }

    function sprite(frameData, x, y, col, s) {
      ctx.fillStyle = col;
      for (let r = 0; r < frameData.length; r++) for (let c = 0; c < frameData[r].length; c++) if (frameData[r][c] === '#') ctx.fillRect(x + c * s, y + r * s, s, s);
    }
    function draw() {
      ctx.fillStyle = COL.ink; ctx.fillRect(-20, -20, W + 40, H + 40);
      for (let i = 0; i < 40; i++) { ctx.globalAlpha = .2 + .25 * Math.sin(t * 2 + i); ctx.fillStyle = COL.text; ctx.fillRect((i * 97) % W, (i * 53 + t * 8 * (1 + i % 3)) % H, 1.5, 1.5); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = rgba(COL.lime, .5); ctx.fillRect(0, SY + 22, W, 2);
      for (const s of shields || []) {
        for (let r = 0; r < 7; r++) for (let c = 0; c < 11; c++) if (s.cells[r][c]) { ctx.fillStyle = r < 2 ? COL.lime : mix(COL.lime, COL.ink, .25); ctx.fillRect(s.x + c * 5, s.y + r * 5, 5, 5); ctx.fillStyle = rgba(COL.ink, .25); ctx.fillRect(s.x + c * 5 + 4, s.y + r * 5, 1, 5); }
      }
      if (ufo) {
        ctx.save(); ctx.translate(ufo.x + 17, 44);
        if (!cfg.low) { ctx.shadowColor = COL.magenta; ctx.shadowBlur = 12; }
        ctx.fillStyle = COL.magenta; ctx.beginPath(); ctx.ellipse(0, 2, 17, 6, 0, 0, TAU); ctx.fill(); ctx.fillStyle = mix(COL.magenta, COL.text, .5); ctx.beginPath(); ctx.ellipse(0, -3, 8, 6, 0, Math.PI, 0); ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = COL.amber; for (let i = -2; i <= 2; i++) ctx.fillRect(i * 6 - 1, 3 + Math.sin(t * 10 + i) * 1, 3, 2);
        ctx.restore();
      }
      for (const a of aliens) if (a.alive) { const p = pos(a); sprite(SPR[a.ty][frame], p.x, p.y, sprCol(a.ty), PS); }
      for (const b of pb) { ctx.fillStyle = COL.text; ctx.fillRect(b.x - 1.5, b.y - 5, 3, 10); ctx.fillStyle = rgba(COL.cyan, .5); ctx.fillRect(b.x - 1.5, b.y + 5, 3, 8); }
      for (const b of ab) { ctx.strokeStyle = COL.magenta; ctx.lineWidth = 2.5; ctx.beginPath(); for (let k = 0; k <= 6; k++) { const yy = b.y - 6 + k * 2, xx = b.x + Math.sin(b.ph + k) * 2.5; if (k) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); } ctx.stroke(); }
      if (st !== 'dead' && (invuln <= 0 || Math.floor(t * 14) % 2)) {
        ctx.save(); ctx.translate(ship.x, SY); if (!cfg.low) { ctx.shadowColor = COL.cyan; ctx.shadowBlur = 14; }
        ctx.fillStyle = COL.cyan; ctx.fillRect(-SW / 2, 2, SW, 10); ctx.fillRect(-SW / 2 + 5, -4, SW - 10, 8); ctx.fillRect(-3, -14, 6, 12); ctx.shadowBlur = 0;
        ctx.fillStyle = rgba(COL.text, .35); ctx.fillRect(-SW / 2, 2, SW, 2); ctx.fillStyle = COL.magenta; ctx.fillRect(-2, 6, 4, 4);
        ctx.restore();
      }
      if (st === 'ready') {
        ctx.fillStyle = rgba(COL.ink, .5); ctx.fillRect(0, 0, W, H);
        txt('ZAP INVADERS', W / 2, H / 2 - 40, { font: FD, size: 30, color: COL.lime });
        txt('Pulsa Espacio o toca para empezar', W / 2, H / 2 + 4, { size: 13 });
      }
      if (st === 'dead' && deadT > .6) banner(W, H, 'INVASIÓN CONSUMADA', COL.magenta, [pad5(score) + ' puntos · oleada ' + (wave + 1) + (newBest ? ' · nuevo récord' : ''), 'Espacio o toca para reintentar']);
    }

    function setMode(id) { M = MODES[id] || MODES.classic; reset(); }
    return {
      W, H,
      enter(id) { hud.init(['Puntos', 'Récord', 'Vidas', 'Oleada']); setMode(id); },
      setMode,
      leave() { keys.l = keys.r = keys.f = false; holding = false; },
      blur() { keys.l = keys.r = keys.f = false; holding = false; },
      update, draw,
      down(p) { ship.tx = clamp(p.x, SW / 2, W - SW / 2); holding = true; fire(); },
      move(p) { if (holding || K.canHover) ship.tx = clamp(p.x, SW / 2, W - SW / 2); },
      up() { holding = false; },
      controls(el) {
        K.pad.buttons(el, [
          { label: '◀', cls: 'sq', down: () => { keys.l = true; }, up: () => { keys.l = false; } },
          { label: 'DISPARAR', down: () => { keys.f = true; fire(); }, up: () => { keys.f = false; } },
          { label: '▶', cls: 'sq', down: () => { keys.r = true; }, up: () => { keys.r = false; } }
        ]);
      },
      key(e, down) {
        const c = e.code;
        if (c === 'ArrowLeft' || c === 'KeyA') { keys.l = down; return true; }
        if (c === 'ArrowRight' || c === 'KeyD') { keys.r = down; return true; }
        if (c === 'Space' || c === 'ArrowUp' || c === 'KeyW') { keys.f = down; if (down && !e.repeat) fire(); return true; }
        return false;
      },
      state: () => ({ alive, total, score, lives, wave, st, shipX: ship.x, ab: ab.length, list: aliens.filter(a => a.alive).map(a => pos(a)) }),
      init() { reset(); }
    };
  }
});
