/* Glitch Runner · runner infinito con cuatro modos */
ZAP.register({
  id: 'runner', name: 'Glitch Runner', tag: 'salta firewalls, agáchate ante drones', genre: 'Acción', color: 'cyan', icon: 'runner',
  modes: [
    { id: 'normal', name: 'Normal', desc: 'El clásico. La velocidad sube con tu puntuación.' },
    { id: 'turbo', name: 'Turbo', desc: 'Arranca rápido y acaba a velocidad de vértigo.' },
    { id: 'night', name: 'Noche', desc: 'Apagón: solo ves lo que ilumina tu linterna.' },
    { id: 'moon', name: 'Luna', desc: 'Poca gravedad: saltos largos y flotantes.' }
  ],
  skins: [{ id: 'cyan', name: 'Cian', lvl: 0 }, { id: 'magenta', name: 'Rosa', lvl: 2 }, { id: 'gold', name: 'Dorado', lvl: 4 }, { id: 'ghost', name: 'Espectro', lvl: 6 }],
  hint: '<kbd>Espacio</kbd> o <kbd>↑</kbd> para saltar (mantén para llegar más alto) y <kbd>↓</kbd> para agacharte. Los drones bajos se saltan, los medios se esquivan agachado y los altos se cruzan por debajo. En el móvil, toca la pantalla o usa los botones.',
  ach: [
    { id: 'run500', name: 'Sin parar', desc: 'Llega a 500 puntos en Glitch Runner', icon: 'runner', test: (p, r) => !!r && r.game === 'runner' && r.value >= 500 },
    { id: 'runnight', name: 'Visión nocturna', desc: '200 puntos en el modo Noche', icon: 'ghost', test: (p, r) => !!r && r.game === 'runner' && r.mode === 'night' && r.value >= 200 }
  ],
  create(K) {
    const { ctx, canvas, COL, TAU, clamp, rand, mix, rgba, txt, banner, burst, sfx, hud, pad5, addShake, announce, FD, FB } = K;
    const W = 720, H = 280, GY = 224, PX = 72;
    const MODES = {
      normal: { base: 320, max: 720, G: 2300, jump: 790, acc: .9 },
      turbo: { base: 460, max: 900, G: 2600, jump: 830, acc: 1.2 },
      night: { base: 340, max: 720, G: 2300, jump: 790, acc: .9, night: true },
      moon: { base: 300, max: 640, G: 1250, jump: 620, acc: .8 }
    };
    let M = MODES.normal, skin = 'cyan';
    let SECT = [COL.cyan, COL.violet, COL.magenta, COL.lime];
    let tc = { key: '' };
    let st, t = 0, dist, score, speed, newBest;
    let py, pv, onGround, duck, jumpHeld, holdUntil, jumpBuf, phase, obs, since, gap, deadT, dustT, groundOff, bgOff, tint, sector, lastHundred, milestone;

    function makeSky(sp, hr, wr, al) {
      const b = []; let x = 0;
      while (x < W + 160) {
        const w = Math.floor(rand(wr[0], wr[1]));
        b.push({ x, w, h: Math.floor(rand(hr[0], hr[1])), seed: Math.floor(Math.random() * 1000) });
        x += w + Math.floor(rand(2, 10));
      }
      return { sp, al, b, L: x };
    }
    const sky = [makeSky(.12, [36, 92], [28, 60], .07), makeSky(.28, [48, 140], [22, 48], .13)];
    const rain = Array.from({ length: 34 }, () => ({ x: rand(0, W), y: rand(0, H), v: rand(20, 70), c: Math.random() < .5 ? '0' : '1', a: rand(.06, .2) }));
    const stars = Array.from({ length: 40 }, () => ({ x: rand(0, W), y: rand(0, 150), r: Math.random() < .2 ? 2 : 1, p: rand(0, TAU) }));

    function reset() {
      st = 'ready'; dist = 0; score = 0; speed = M.base; newBest = false;
      py = 0; pv = 0; onGround = true; duck = false; jumpHeld = false; holdUntil = 0; jumpBuf = 0; phase = 0;
      obs = []; since = 0; gap = 380; deadT = 0; dustT = 0; groundOff = 0; bgOff = 0;
      sector = 0; tint = COL.cyan; lastHundred = 0; milestone = 0;
    }
    function pressJump() {
      if (st === 'dead') { if (deadT > .45) { reset(); st = 'run'; } return; }
      if (st === 'ready') st = 'run';
      jumpHeld = true; holdUntil = t + .14; jumpBuf = .12;
    }
    function releaseJump() { jumpHeld = false; }
    function setDuck(v) { duck = v; }

    function spawn() {
      const x = W + 40, r = Math.random();
      if (score > 150 && r < .24) {
        const q = Math.random(), y = q < .3 ? 140 : q < .7 ? 176 : 202;
        obs.push({ k: 'drone', x, y, w: 34, h: 20, ph: 0 });
      } else if (r < .64) {
        const n = 1 + (Math.random() < .35 ? 1 : 0) + (score > 250 && Math.random() < .25 ? 1 : 0);
        const h = Math.floor(rand(34, 58));
        obs.push({ k: 'wall', x, y: GY - h, w: 18 * n, h, n, ph: 0 });
      } else {
        obs.push({ k: 'bug', x, y: GY - 20, w: 22, h: 20, ph: 0 });
        if (Math.random() < .35) obs.push({ k: 'bug', x: x + 40, y: GY - 20, w: 22, h: 20, ph: 1.7 });
      }
    }
    function die() {
      st = 'dead'; deadT = 0;
      addShake(12); sfx.die();
      burst(PX + 11, GY - py - 22, 34, COL.cyan, { speed: 340, life: 1, grav: 600, size: 4 });
      burst(PX + 11, GY - py - 22, 16, COL.magenta, { speed: 260, life: .8, grav: 500, size: 3 });
      newBest = K.profile.submit(score).isBest;
      announce('Sistema caído. ' + score + ' puntos.');
    }

    function update(dt) {
      t += dt;
      for (const r of rain) { r.y += r.v * dt; if (r.y > H) { r.y = -10; r.x = rand(0, W); } }
      if (st === 'run') {
        speed = Math.min(M.max, M.base + score * M.acc);
        dist += speed * dt; score = Math.floor(dist / 40);
        bgOff += speed * dt; groundOff += speed * dt; phase += speed * dt * .04;
        const held = jumpHeld || t < holdUntil;
        if (jumpBuf > 0) {
          jumpBuf -= dt;
          if (onGround) {
            pv = M.jump; onGround = false; jumpBuf = 0; sfx.jump();
            burst(PX + 12, GY, 8, rgba(COL.cyan, .8), { speed: 90, life: .35, grav: 100, size: 2.5, angle: -Math.PI / 2, spread: Math.PI });
          }
        }
        if (!onGround) {
          let m = 1;
          if (pv > 0 && !held) m = 2.2;
          if (duck) m = 2.8;
          pv -= M.G * m * dt; py += pv * dt;
          if (py <= 0) {
            py = 0; pv = 0; onGround = true; sfx.land();
            burst(PX + 12, GY, 8, rgba(COL.cyan, .8), { speed: 90, life: .35, grav: 100, size: 2.5, angle: -Math.PI / 2, spread: Math.PI });
          }
        }
        dustT -= dt;
        if (onGround && dustT <= 0) {
          burst(PX + 4, GY - 1, 1, rgba(tint, .8), { speed: 50, life: .3, grav: -10, size: 2.5, angle: Math.PI, spread: .8 });
          dustT = .07;
        }
        since += speed * dt;
        if (since >= gap) { spawn(); since = 0; gap = speed * rand(.75, 1.25) + 60; }
        for (const o of obs) { o.x -= speed * dt; o.ph += dt * 20; }
        let keep = 0;
        for (let n = 0; n < obs.length; n++) { const o = obs[n]; if (o.x + o.w > -60) obs[keep++] = o; }
        obs.length = keep;
        const hb = duck ? { x: PX + 2, y: GY - py - 24, w: 26, h: 24 } : { x: PX + 4, y: GY - py - 40, w: 16, h: 40 };
        for (const o of obs) {
          const ins = o.k === 'drone' ? 4 : 3;
          if (hb.x < o.x + o.w - ins && hb.x + hb.w > o.x + ins && hb.y < o.y + o.h - ins && hb.y + hb.h > o.y + ins) { die(); break; }
        }
        if (st === 'run' && score >= lastHundred + 100) {
          lastHundred += 100; sfx.point(); milestone = 1; hud.bump(0);
          K.popText(PX + 10, GY - py - 70, lastHundred, COL.amber);
        }
        sector = Math.floor(score / 250);
      }
      if (st === 'dead') deadT += dt;
      milestone = Math.max(0, milestone - dt * 2);
      tint = mix(tint, SECT[sector % 4], Math.min(1, dt * 2));
      hud.set(0, pad5(score)); hud.set(1, pad5(K.profile.best() || 0)); hud.set(2, Math.round(speed / 6) + ' Mb/s');
    }

    function drawHacker(x, fy, dk, air) {
      const sk = skin === 'magenta' ? [COL.magenta, COL.cyan] : skin === 'gold' ? [COL.amber, COL.violet] : skin === 'ghost' ? [COL.text, COL.violet] : [COL.cyan, COL.magenta];
      const C1 = sk[0], C2 = mix(C1, COL.ink, .55), VIS = sk[1];
      const bob = air ? 0 : Math.abs(Math.sin(phase)) * 1.5;
      if (!dk) {
        const l1 = air ? 4 : Math.max(0, Math.sin(phase)) * 6, l2 = air ? 4 : Math.max(0, -Math.sin(phase)) * 6;
        ctx.fillStyle = C2;
        ctx.fillRect(x + 3, fy - 12, 8, 12 - l1);
        ctx.fillRect(x + 13, fy - 12, 8, 12 - l2);
        ctx.fillRect(x - 5, fy - 24 - bob, 7, 10);
        ctx.fillStyle = C1;
        ctx.fillRect(x + 1, fy - 26 - bob, 22, 14);
        ctx.fillRect(x + 2, fy - 44 - bob, 20, 18);
        ctx.fillStyle = mix(C1, COL.ink, .25);
        ctx.fillRect(x + 2, fy - 44 - bob, 20, 4);
        ctx.fillStyle = rgba(VIS, .35);
        ctx.fillRect(x + 9, fy - 39 - bob, 15, 9);
        ctx.fillStyle = VIS;
        ctx.fillRect(x + 11, fy - 37 - bob, 12, 5);
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = rgba(VIS, .9 - i * .25);
          ctx.fillRect(x - 3 - i * 7, fy - 27 - bob + Math.sin(t * 16 + i * 1.2) * 2 + i * 1.5, 7, 4);
        }
      } else {
        const s = Math.sin(phase * 1.4) * 2;
        ctx.fillStyle = C2;
        ctx.fillRect(x + 4 + s, fy - 6, 9, 6);
        ctx.fillRect(x + 15 - s, fy - 6, 9, 6);
        ctx.fillRect(x - 4, fy - 17, 8, 8);
        ctx.fillStyle = C1;
        ctx.fillRect(x + 2, fy - 16, 26, 10);
        ctx.fillRect(x + 10, fy - 28, 18, 12);
        ctx.fillStyle = rgba(VIS, .35);
        ctx.fillRect(x + 17, fy - 25, 12, 8);
        ctx.fillStyle = VIS;
        ctx.fillRect(x + 19, fy - 24, 9, 4);
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = rgba(VIS, .9 - i * .25);
          ctx.fillRect(x - 7 - i * 7, fy - 18 + Math.sin(t * 16 + i * 1.2) * 2, 7, 4);
        }
      }
    }
    function drawWall(o) {
      const { x, y, w, h } = o;
      ctx.fillStyle = mix(COL.magenta, COL.ink, .62); ctx.fillRect(x, y, w, h);
      ctx.fillStyle = rgba(COL.magenta, .9);
      ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y, 2, h); ctx.fillRect(x + w - 2, y, 2, h);
      ctx.fillStyle = rgba(COL.ink, .55);
      for (let yy = y + 10; yy < y + h; yy += 10) ctx.fillRect(x, yy, w, 1);
      const fw = w / (o.n * 2);
      for (let k = 0; k < o.n * 2; k++) {
        const fx = x + k * fw, fh = 5 + Math.abs(Math.sin(t * 9 + k * 1.7 + x * .02)) * 7;
        ctx.fillStyle = k % 2 ? COL.amber : COL.magenta;
        ctx.beginPath(); ctx.moveTo(fx, y); ctx.lineTo(fx + fw / 2, y - fh); ctx.lineTo(fx + fw, y); ctx.fill();
      }
    }
    function drawBug(o) {
      const x = o.x, y = o.y;
      ctx.fillStyle = COL.amber;
      ctx.fillRect(x + 3, y + 5, 16, 11); ctx.fillRect(x + 6, y + 2, 10, 4);
      ctx.fillStyle = COL.ink;
      ctx.fillRect(x + 7, y + 7, 3, 3); ctx.fillRect(x + 13, y + 7, 3, 3);
      ctx.strokeStyle = COL.amber; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const yy = y + 8 + k * 4, sw = Math.sin(o.ph + k) * 2;
        ctx.moveTo(x + 3, yy); ctx.lineTo(x - 2, yy + sw + 2);
        ctx.moveTo(x + 19, yy); ctx.lineTo(x + 24, yy + sw + 2);
      }
      ctx.moveTo(x + 8, y + 2); ctx.lineTo(x + 5, y - 3);
      ctx.moveTo(x + 14, y + 2); ctx.lineTo(x + 17, y - 3);
      ctx.stroke();
    }
    function drawDrone(o) {
      const x = o.x, y = o.y;
      ctx.fillStyle = mix(COL.lime, COL.ink, .5); ctx.fillRect(x + 4, y + 6, 26, 10);
      ctx.fillStyle = COL.lime; ctx.fillRect(x + 6, y + 6, 22, 4);
      ctx.fillStyle = COL.magenta; ctx.fillRect(x + 13, y + 11, 8, 3);
      const rw = 14 + Math.sin(o.ph) * 6;
      ctx.fillStyle = rgba(COL.lime, .8);
      ctx.fillRect(x + 17 - rw, y + 2, rw * 2, 2); ctx.fillRect(x + 15, y + 2, 4, 5);
      ctx.fillStyle = COL.lime; ctx.fillRect(x + 6, y + 17, 6, 2); ctx.fillRect(x + 22, y + 17, 6, 2);
    }
    function glitchSlices(n, amt) {
      const S = K.S();
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (let i = 0; i < n; i++) {
        const sy = Math.floor(rand(0, canvas.height - 24)), sh = Math.floor(rand(4, 24) * S), dx = Math.floor(rand(-amt, amt) * S);
        ctx.drawImage(canvas, 0, sy, canvas.width, sh, dx, sy, canvas.width, sh);
      }
      ctx.restore();
    }

    function draw() {
      if (tc.key !== tint) {
        tc = { key: tint, grad: null, l0: mix(COL.ink, tint, sky[0].al), l1: mix(COL.ink, tint, sky[1].al), ground: mix(COL.ink, tint, .08), win: rgba(tint, .5), tick: rgba(tint, .35) };
        const g = ctx.createLinearGradient(0, 0, 0, GY);
        g.addColorStop(0, mix(COL.ink, tint, .03)); g.addColorStop(1, mix(COL.ink, tint, .2));
        tc.grad = g;
      }
      ctx.fillStyle = tc.grad; ctx.fillRect(-20, -20, W + 40, H + 40);
      for (const s of stars) { ctx.globalAlpha = .25 + .3 * Math.sin(t * 2 + s.p); ctx.fillStyle = COL.text; ctx.fillRect(s.x, s.y, s.r, s.r); }
      ctx.globalAlpha = 1;
      sky.forEach((layer, li) => {
        const off = (bgOff * layer.sp) % layer.L, col = li === 0 ? tc.l0 : tc.l1;
        for (const rep of [-off, -off + layer.L]) {
          for (const b of layer.b) {
            const x = b.x + rep;
            if (x > W || x + b.w < 0) continue;
            ctx.fillStyle = col; ctx.fillRect(x, GY - b.h, b.w, b.h);
            if (li === 1) {
              ctx.fillStyle = tc.win;
              for (let r = 0; r * 9 + 6 < b.h - 6; r++) for (let c = 0; c * 8 + 4 < b.w - 6; c++) {
                if ((r * 7 + c * 13 + b.seed) % 6 === 0) ctx.fillRect(x + 4 + c * 8, GY - b.h + 6 + r * 9, 3, 4);
              }
            }
          }
        }
      });
      ctx.font = '10px ' + FB; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillStyle = tint;
      for (const r of rain) { ctx.globalAlpha = r.a; ctx.fillText(r.c, r.x, r.y); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = tc.ground; ctx.fillRect(0, GY, W, H - GY);
      ctx.fillStyle = tint; ctx.fillRect(0, GY, W, 2);
      ctx.fillStyle = tc.tick;
      for (let x = -(groundOff % 48); x < W; x += 48) ctx.fillRect(x, GY + 12, 22, 2);
      for (let x = -((groundOff * 1.3) % 64) + 20; x < W; x += 64) ctx.fillRect(x, GY + 28, 10, 2);
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      for (const o of obs) {
        if (o.k === 'drone') continue;
        ctx.beginPath(); ctx.ellipse(o.x + o.w / 2, GY + 3, o.w * .6, 3, 0, 0, TAU); ctx.fill();
      }
      if (st !== 'dead') {
        const sc = clamp(1 - py / 220, .35, 1);
        ctx.beginPath(); ctx.ellipse(PX + 12, GY + 3, 16 * sc, 3.5 * sc, 0, 0, TAU); ctx.fill();
      }
      for (const o of obs) { if (o.k === 'wall') drawWall(o); else if (o.k === 'bug') drawBug(o); else drawDrone(o); }
      if (st !== 'dead' || deadT < .05) drawHacker(PX, GY - py, duck, !onGround);
      if (M.night) {
        const cy = GY - py - 20;
        ctx.save(); ctx.translate(PX + 60, cy); ctx.scale(1.7, 1);
        const g = ctx.createRadialGradient(0, 0, 20, 0, 0, 150);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, rgba(COL.ink, .97));
        ctx.fillStyle = g; ctx.fillRect(-400, -300, 800, 600);
        ctx.restore();
      }
      if (st === 'dead' && deadT < .6) {
        ctx.fillStyle = rgba(COL.magenta, (1 - deadT / .6) * .22); ctx.fillRect(-20, -20, W + 40, H + 40);
        glitchSlices(5, 20 * (1 - deadT / .6));
      }
      if (milestone > 0) { ctx.fillStyle = rgba(COL.text, milestone * .08); ctx.fillRect(-20, -20, W + 40, H + 40); }
      if (st === 'ready') {
        txt('GLITCH RUNNER', W / 2, 92, { font: FD, size: 34, color: COL.cyan });
        txt('ESPACIO, ↑ O TOCA LA PANTALLA PARA EMPEZAR', W / 2, 132, { size: 13, color: COL.text });
      }
      if (st === 'dead' && deadT > .4) {
        banner(W, H, 'SISTEMA CAÍDO', COL.magenta, [
          pad5(score) + ' puntos' + (newBest ? ' · nuevo récord' : ''),
          'Espacio o toca para reiniciar'
        ]);
      }
    }

    function recolor() {
      SECT = [COL.cyan, COL.violet, COL.magenta, COL.lime];
      tint = SECT[(sector | 0) % 4]; tc = { key: '' };
    }
    function setMode(id) { M = MODES[id] || MODES.normal; reset(); }

    return {
      W, H, recolor,
      enter(mode) { hud.init(['Puntos', 'Récord', 'Ancho de banda']); setMode(mode); },
      setMode,
      leave() { jumpHeld = false; duck = false; },
      update, draw,
      down() { pressJump(); }, up() { releaseJump(); },
      controls(el) {
        K.pad.buttons(el, [
          { label: 'SALTAR', down: pressJump, up: releaseJump },
          { label: 'AGACHAR', down: () => setDuck(true), up: () => setDuck(false) }
        ]);
      },
      key(e, down) {
        const c = e.code;
        if (c === 'Space' || c === 'ArrowUp' || c === 'KeyW') { if (down) { if (!e.repeat) pressJump(); } else releaseJump(); return true; }
        if (c === 'ArrowDown' || c === 'KeyS') { setDuck(down); return true; }
        return false;
      },
      setSkin(id) { skin = id; K.redraw(); },
      state: () => ({ st, score, py, speed, obs: obs.map(o => ({ k: o.k, x: o.x, y: o.y, w: o.w, h: o.h })) }),
      init: reset
    };
  }
});
