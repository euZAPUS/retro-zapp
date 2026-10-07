/* © 2026 euZAPUS · Todos los derechos reservados. Ver LICENSE. */
/* Captura de material para el anuncio de ZAP Arcade.
   Usa el reloj virtual de Playwright (page.clock) para sacar frames deterministas a 30 fps del arcade real,
   con bots que juegan. Uso: OUT=/ruta node capture.js [clip1 clip2 ...]
   Requiere un servidor en http://localhost:8765 sirviendo la raíz del repo (python3 -m http.server 8765). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = process.env.OUT || path.join(__dirname, 'out');
const URL = 'http://localhost:8765/demos/arcade/';
const VIEW = { width: 1280, height: 1100 }, DPR = 1.25, FPS = 30, DT = 1000 / FPS;
const only = process.argv.slice(2);

/* ---------- perfil de ejemplo (nivel alto, récords y logros) ---------- */
function profile() {
  const now = Date.now(), rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const ramp = (end, n = 18, low = false) => Array.from({ length: n }, (_, i) => Math.max(1, Math.round(low ? end * (1.9 - i / n * .9) + rnd(0, 6) : end * (.25 + i / n * .75) * (0.85 + Math.random() * .3))));
  const mk = (plays, time, modes) => ({ plays, time, last: now - rnd(0, 5) * 3600e3, modes: Object.fromEntries(Object.entries(modes).map(([m, [best, low]]) => [m, { plays: rnd(6, 30), best, hist: ramp(best, 18, low).concat([best]) }])) });
  const games = {
    runner: mk(64, 2400, { normal: [1840], turbo: [1210], night: [760], moon: [980] }),
    sweeper: mk(31, 1500, { facil: [21, true], medio: [64, true], dificil: [158, true] }),
    worm: mk(58, 2100, { classic: [38], portal: [46], maze: [27], poison: [19], fast: [24], feast: [52] }),
    breakout: mk(40, 1800, { classic: [2450], multi: [3120], hardcore: [1260] }),
    pong: mk(35, 1500, { rally: [31], easy: [5], normal: [4], hard: [2] }),
    tetris: mk(47, 3100, { marathon: [18400], sprint: [71.3, true], ultra: [9650], ghost: [4200] }),
    '2048': mk(29, 2000, { n4: [12480], n5: [31200], n3: [1480], timed: [6200] }),
    flappy: mk(52, 1300, { normal: [37], moon: [44], narrow: [18], moving: [22] }),
    memory: mk(26, 1100, { easy: [11, true], normal: [19, true], hard: [48, true], shuffle: [34, true] }),
    simon: mk(33, 900, { classic: [14], reverse: [9], fast: [12], random: [8] }),
    invaders: mk(37, 1700, { classic: [4210], rapid: [3680], swarm: [2890] }),
    whack: mk(30, 1200, { classic: [1980], survival: [1420], bombs: [860] }),
    connect4: mk(44, 2200, { easy: [7], normal: [5], hard: [3], duo: [1] })
  };
  const ach = {};
  const ids = ['first', 'p10', 'p50', 'try5', 'tryall', 'modes10', 'rec5', 'rec25', 'time10', 'time60', 'lvl5', 'streak3', 'stylist', 'custom', 'avatar', 'skinner', 'run500', 'runnight', 'swhard', 'swfast', 'worm30', 'wormportal', 'brk3', 'brkhard', 'pong20', 'pongwin', 'tet4', 'tet50', 'tetsprint', 'tile512', 'flap25', 'flapnarrow', 'memperfect', 'simon10', 'simonrev', 'inv3', 'invufo', 'whack300', 'whackbomb', 'c4hard', 'c4streak'];
  ids.forEach((id, i) => { ach[id] = now - (i + 1) * 86400e3 / 3; });
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(now - (13 - i) * 86400e3); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  const visits = Object.fromEntries(Object.keys(games).map(k => [k, 5]));
  return { v: 1, name: 'Alex', avatar: { ico: 'bolt', col: 'cyan' }, created: now - 20 * 86400e3, xp: 5600, time: 21300, plays: 486, records: 61, visits, games, ach, days };
}

function seedScript(seed, cfg, extra) {
  return `(() => {
    let s = ${seed} >>> 0;
    Math.random = function () { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const set = (k, v) => localStorage.setItem('zap-arcade:' + k, JSON.stringify(v));
    set('profile', ${JSON.stringify(profile())});
    set('welcomed', true); set('muted', true);
    set('cfg', ${JSON.stringify(cfg)});
    const ex = ${JSON.stringify(extra || {})}; for (const k in ex) set(k, ex[k]);
  })();`;
}
const NO_ANIM = '*,*::before,*::after{transition:none!important;animation:none!important}.toasts{display:none!important}';
const CFG = o => Object.assign({ skin: 'neon', accent: '', glass: true, tilt: false, low: false, bg: 'orbs', crt: true, frame: 'glass', fx: 1, shake: true, vol: 0 }, o);

/* ---------- bots (se ejecutan dentro de la página, con el reloj virtual) ---------- */
const BOTS = {
  worm: `(() => { const inst = ZAP.games.worm.inst, N = 20; const D = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
    const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
    setInterval(() => { const s = inst.state();
      if (s.st === 'dead') { inst.key({ code: 'Space', repeat: false }, true); return; }
      if (s.st === 'ready') { inst.key({ code: 'ArrowRight', repeat: false }, true); return; }
      const h = s.body[0], occ = new Set(s.body.slice(0, -1).map(b => b.x + ',' + b.y));
      s.walls.forEach((w, i) => { if (w) occ.add((i % N) + ',' + ((i / N) | 0)); });
      s.foods.filter(f => f.kind === 'poison').forEach(f => occ.add(f.x + ',' + f.y));
      const foods = s.foods.filter(f => f.kind !== 'poison');
      const dist = (a, b) => { let dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y); if (s.wrap) { dx = Math.min(dx, N - dx); dy = Math.min(dy, N - dy); } return dx + dy; };
      let best = null;
      for (const k in D) { const d = D[k]; if (d.x === -s.dir.x && d.y === -s.dir.y) continue;
        let nx = h.x + d.x, ny = h.y + d.y; if (s.wrap) { nx = (nx + N) % N; ny = (ny + N) % N; } else if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        if (occ.has(nx + ',' + ny)) continue;
        let free = 0; for (const j in D) { let ax = nx + D[j].x, ay = ny + D[j].y; if (s.wrap) { ax = (ax + N) % N; ay = (ay + N) % N; } if (ax >= 0 && ay >= 0 && ax < N && ay < N && !occ.has(ax + ',' + ay)) free++; }
        const t = foods.length ? Math.min(...foods.map(f => dist({ x: nx, y: ny }, f))) : 0;
        const sc = t * 10 - free * 3 + (d.x === s.dir.x && d.y === s.dir.y ? -.5 : 0);
        if (!best || sc < best.sc) best = { sc, k }; }
      if (best) inst.key({ code: KEY[best.k], repeat: false }, true);
    }, 30); })()`,
  tetris: `(() => { const inst = ZAP.games.tetris.inst; let key = '', plan = null;
    const rot = m => m[0].map((_, x) => m.map(r => r[x]).reverse());
    const coll = (B, m, px, py) => { for (let y = 0; y < m.length; y++) for (let x = 0; x < m[y].length; x++) { if (!m[y][x]) continue; const bx = px + x, by = py + y; if (bx < 0 || bx >= 10 || by >= 20) return true; if (by >= 0 && B[by][bx]) return true; } return false; };
    const ev = B => { const nb = B.filter(r => !r.every(Boolean)), lines = 20 - nb.length; while (nb.length < 20) nb.unshift(Array(10).fill(0)); let agg = 0, holes = 0, bump = 0; const hs = [];
      for (let x = 0; x < 10; x++) { let h = 0, seen = false; for (let y = 0; y < 20; y++) { if (nb[y][x]) { if (!seen) { h = 20 - y; seen = true; } } else if (seen) holes++; } hs.push(h); agg += h; }
      for (let x = 0; x < 9; x++) bump += Math.abs(hs[x] - hs[x + 1]); return lines * 8 - agg * .5 - holes * 5 - bump * .3; };
    setInterval(() => { const s = inst.state();
      if (s.st === 'dead') { inst.key({ code: 'Space', repeat: false }, true); return; }
      if (s.st === 'ready') { inst.key({ code: 'ArrowUp', repeat: false }, true); return; }
      if (s.clearing || !s.cur) return;
      const k = s.cells + '|' + s.lines + '|' + s.cur.n;
      if (k !== key) { key = k; let best = null, m = s.cur.m; const B = s.board;
        for (let r = 0; r < 4; r++) { for (let x = -3; x < 10; x++) { if (coll(B, m, x, 0)) continue; let y = 0; while (!coll(B, m, x, y + 1)) y++;
            const T = B.map(q => q.slice()); let ok = true; m.forEach((row, yy) => row.forEach((v, xx) => { if (v) { if (y + yy < 0) ok = false; else T[y + yy][x + xx] = 1; } }));
            if (!ok) continue; const sc = ev(T); if (!best || sc > best.sc) best = { sc, r, x }; } m = rot(m); }
        plan = best ? { rot: best.r, x: best.x } : { rot: 0, x: s.cur.x }; }
      if (plan.rot > 0) { inst.key({ code: 'ArrowUp', repeat: false }, true); plan.rot--; return; }
      if (s.cur.x !== plan.x) { const c = s.cur.x < plan.x ? 'ArrowRight' : 'ArrowLeft'; inst.key({ code: c, repeat: false }, true); inst.key({ code: c }, false); return; }
      inst.key({ code: 'Space', repeat: false }, true);
    }, 70); })()`,
  runner: `(() => { const inst = ZAP.games.runner.inst; let hold = 0;
    setInterval(() => { const s = inst.state();
      if (s.st === 'ready' || s.st === 'dead') { inst.key({ code: 'Space', repeat: false }, true); inst.key({ code: 'Space' }, false); return; }
      let act = null; for (const o of s.obs) { const d = o.x - 96; if (d < -20) continue; if (d > s.speed * .24) break;
        if (o.k === 'drone') { if (o.y >= 195) act = 'jump'; else if (o.y > 150) act = 'duck'; } else act = 'jump'; break; }
      if (hold > 0) { hold--; if (hold === 0) inst.key({ code: 'Space' }, false); }
      if (act === 'jump' && s.py < 1) { inst.key({ code: 'Space', repeat: false }, true); hold = 12; }
      inst.key({ code: 'ArrowDown' }, act === 'duck');
    }, 16); })()`,
  breakout: `(() => { const inst = ZAP.games.breakout.inst; let t = 0;
    setInterval(() => { t += .016; const s = inst.state(); if (s.st === 'ready' || s.st === 'dead') inst.down({ x: s.px, y: 0 });
      const b = s.balls.find(q => !q.stuck) || s.balls[0]; if (b) inst.move({ x: b.x + Math.sin(t * 2.3) * 26, y: 0 }); }, 16); })()`,
  invaders: `(() => { const inst = ZAP.games.invaders.inst;
    setInterval(() => { const s = inst.state(); if (s.st === 'ready' || s.st === 'dead') { inst.key({ code: 'Space', repeat: false }, true); return; }
      let tx = 240; if (s.list.length) { const low = s.list.reduce((a, c) => (c.y > a.y ? c : a), s.list[0]); tx = low.x + 13; }
      inst.move({ x: tx, y: 0 }); inst.down({ x: tx, y: 0 }); inst.up({ x: tx, y: 0 }); }, 30); })()`,
  pong: `(() => { const inst = ZAP.games.pong.inst; let t = 0;
    setInterval(() => { t += .016; const s = inst.state(); if (s.st === 'ready' || s.st === 'dead') inst.down({ x: 0, y: 190 });
      inst.move({ x: 0, y: s.ball.y + Math.sin(t * 1.4) * 48 }); }, 16); })()`,
  g2048: `(() => { const inst = ZAP.games['2048'].inst, seq = ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']; let i = 0;
    setInterval(() => { const s = inst.state(); if (s.st === 'dead') { inst.key({ code: 'KeyR' }, true); return; } inst.key({ code: seq[i++ % seq.length], repeat: false }, true); }, 190); })()`,
  connect4: `(() => { const inst = ZAP.games.connect4.inst, cols = [3, 4, 2, 3, 5, 3, 1]; let i = 0;
    setInterval(() => { const s = inst.state(); if (s.st === 'play' && s.turn === 1) inst.down({ x: 16 + cols[i++ % cols.length] * 64 + 32, y: 200 }); }, 700); })()`
};

/* ---------- definición de tomas ---------- */
const CLIPS = [
  { name: 'worm', hash: 'worm/portal', seed: 7, frames: 165, cfg: CFG({ skin: 'neon', bg: 'orbs' }), extra: { 'skin:worm': 'rainbow' }, bot: BOTS.worm,
    events: { 40: "ZAP.setMode('maze')", 80: "ZAP.setMode('poison')", 120: "ZAP.setMode('fast')" } },
  { name: 'tetris', hash: 'tetris/marathon', seed: 11, frames: 150, cfg: CFG({ skin: 'neon' }), extra: { 'skin:tetris': 'neon' }, bot: BOTS.tetris },
  { name: 'runner', hash: 'runner/normal', seed: 5, frames: 135, cfg: CFG({ skin: 'neon' }), extra: { 'skin:runner': 'gold' }, bot: BOTS.runner },
  { name: 'breakout', hash: 'breakout/multi', seed: 3, frames: 135, cfg: CFG({ skin: 'neon' }), extra: { 'skin:breakout': 'rainbow' }, bot: BOTS.breakout },
  { name: 'invaders', hash: 'invaders/classic', seed: 9, frames: 135, cfg: CFG({ skin: 'neon' }), bot: BOTS.invaders },
  { name: 'pong', hash: 'pong/hard', seed: 4, frames: 150, cfg: CFG({ skin: 'neon' }), extra: { 'skin:pong': 'plasma' }, bot: BOTS.pong },
  { name: 'g2048', hash: '2048/n4', seed: 8, frames: 135, cfg: CFG({ skin: 'neon' }), bot: BOTS.g2048 },
  { name: 'connect4', hash: 'connect4/hard', seed: 6, frames: 165, cfg: CFG({ skin: 'neon' }), extra: { 'skin:connect4': 'gem' }, bot: BOTS.connect4 }
];

async function boot(browser, def, init) {
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DPR });
  await ctx.addInitScript(seedScript(def.seed || 1, def.cfg, def.extra));
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('  PAGEERR', String(e)));
  return { ctx, page };
}

async function runClip(browser, def) {
  const dir = path.join(OUT, 'clips', def.name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const { ctx, page } = await boot(browser, def);
  await page.clock.install({ time: Date.now() });
  await page.goto(URL + '#' + def.hash);
  await page.clock.runFor(800);
  await page.addStyleTag({ content: NO_ANIM });
  await page.clock.runFor(300);
  /* sin pausar, el tiempo corre solo además de runFor y los juegos van ~4x más rápido */
  await page.clock.pauseAt(new Date(Date.now() + 2000));
  const ready = await page.evaluate('window.ZAP_READY === true'); if (!ready) throw new Error('arcade no listo: ' + def.name);
  const rect = await page.evaluate(() => { const r = e => { const b = document.querySelector(e).getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
    return { play: r('#play'), screen: r('.screen'), hud: r('#hud') }; });
  const pad = 24, clip = { x: Math.max(0, Math.floor(rect.play.x - pad)), y: Math.max(0, Math.floor(rect.play.y - 4)), width: Math.ceil(rect.play.w + pad * 2), height: Math.ceil(rect.play.h + 10) };
  clip.width = Math.min(clip.width, VIEW.width - clip.x); clip.height = Math.min(clip.height, VIEW.height - clip.y);
  await page.evaluate(def.bot);
  for (let f = 0; f < def.frames; f++) {
    if (def.events && def.events[f]) await page.evaluate(def.events[f]);
    await page.clock.runFor(DT);
    await page.screenshot({ path: path.join(dir, String(f + 1).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 90, clip });
  }
  const dead = await page.evaluate(() => { const c = ZAP.cur(); const s = c.inst.state && c.inst.state(); return s ? s.st : '?'; });
  fs.writeFileSync(path.join(OUT, 'clips', def.name + '.json'), JSON.stringify({ frames: def.frames, clip, screen: { x: rect.screen.x - clip.x, y: rect.screen.y - clip.y, w: rect.screen.w, h: rect.screen.h }, hud: { x: rect.hud.x - clip.x, y: rect.hud.y - clip.y, w: rect.hud.w, h: rect.hud.h }, dpr: DPR }));
  console.log('clip', def.name, def.frames, 'frames · estado final:', dead, '· recorte', clip.width + 'x' + clip.height);
  await ctx.close();
}

/* tomas estáticas: menú con distintos temas y pestañas del perfil */
async function runStills(browser) {
  const dir = path.join(OUT, 'stills'); fs.mkdirSync(dir, { recursive: true });
  const themes = [['neon', 'orbs', 'glass', ''], ['vapor', 'grid', 'neon', ''], ['sunset', 'orbs', 'glass', ''], ['gold', 'stars', 'cabinet', ''], ['ice', 'orbs', 'glass', ''], ['matrix', 'grid', 'glass', '']];
  for (const [skin, bg, frame, accent] of themes) {
    const def = { seed: 2, cfg: CFG({ skin, bg, frame, accent }), extra: { last: 'tetris' } };
    const { ctx, page } = await boot(browser, def);
    await page.goto(URL); await page.waitForFunction('window.ZAP_READY === true'); await page.addStyleTag({ content: NO_ANIM }); await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(dir, 'hub-' + skin + '.jpg'), type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: 1280, height: 900 } });
    await ctx.close();
  }
  const def = { seed: 2, cfg: CFG({ skin: 'neon' }), extra: { last: 'tetris' } };
  const { ctx, page } = await boot(browser, def);
  await page.goto(URL); await page.waitForFunction('window.ZAP_READY === true'); await page.addStyleTag({ content: NO_ANIM });
  await page.click('#profBtn'); await page.waitForTimeout(400);
  for (const t of ['resumen', 'records', 'logros']) {
    await page.click('.tabs2 button[data-tab="' + t + '"]'); await page.waitForTimeout(1200);
    const b = await page.evaluate(() => { const r = document.querySelector('.dlg').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    await page.screenshot({ path: path.join(dir, 'profile-' + t + '.jpg'), type: 'jpeg', quality: 92, clip: { x: b.x - 6, y: b.y - 6, width: b.w + 12, height: b.h + 12 } });
    fs.writeFileSync(path.join(dir, 'profile-' + t + '.json'), JSON.stringify(b));
  }
  await ctx.close();
  /* iconos para el anuncio */
  const p2 = await boot(browser, def);
  await p2.page.goto(URL); await p2.page.waitForFunction('window.ZAP_READY === true');
  fs.writeFileSync(path.join(OUT, 'icons.json'), JSON.stringify(await p2.page.evaluate(() => ({ icons: ZAP.ICONS, order: ZAP.order.map(id => ({ id, name: ZAP.games[id].name, color: ZAP.games[id].color, icon: ZAP.games[id].icon })) }))));
  await p2.ctx.close();
  console.log('stills ok');
}

/* toma de la app de escritorio: actualización 1.0.1 -> 1.0.2 con el puente simulado */
async function runDesktop(browser) {
  const name = 'desktop', frames = 180, dir = path.join(OUT, 'clips', name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const stub = `window.__st = { status: 'available', version: '1.0.1', available: '1.0.2', progress: 0, error: null };
    window.zapDesktop = { isDesktop: true, platform: 'win32', getState: () => Promise.resolve(window.__st), runUpdate: () => {}, onState: cb => { window.__cb = cb; return () => {}; } };`;
  const def = { seed: 2, cfg: CFG({ skin: 'neon' }), extra: { last: 'tetris' } };
  const { ctx, page } = await boot(browser, def, stub);
  await page.clock.install({ time: Date.now() });
  await page.goto(URL); await page.clock.runFor(900); await page.addStyleTag({ content: NO_ANIM }); await page.clock.runFor(300);
  await page.clock.pauseAt(new Date(Date.now() + 2000));
  await page.evaluate("document.getElementById('cfgBtn').click()"); await page.clock.runFor(300);
  const btn = await page.evaluate(() => { const b = document.querySelector('.updmsg').parentElement.querySelector('button').getBoundingClientRect(); const c = document.getElementById('cfgBtn').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, cfg: { x: c.x + c.width / 2, y: c.y + c.height / 2 } }; });
  const clip = { x: 0, y: 0, width: 1280, height: 860 };
  /* calendario: 0-59 disponible · 60-120 descargando · 121-135 instalando · 136+ tras reiniciar */
  for (let f = 0; f < frames; f++) {
    let st;
    if (f < 60) st = { status: 'available', version: '1.0.1', available: '1.0.2', progress: 0 };
    else if (f < 122) st = { status: 'downloading', version: '1.0.1', available: '1.0.2', progress: Math.min(100, Math.round((f - 60) / 60 * 100)) };
    else if (f < 138) st = { status: 'installing', version: '1.0.1', available: '1.0.2', progress: 100 };
    else st = { status: 'uptodate', version: '1.0.2', available: null, progress: 0 };
    await page.evaluate(s => { window.__st = Object.assign({ error: null }, s); window.__cb && window.__cb(window.__st); }, st);
    await page.clock.runFor(DT);
    await page.screenshot({ path: path.join(dir, String(f + 1).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 92, clip });
  }
  fs.writeFileSync(path.join(OUT, 'clips', name + '.json'), JSON.stringify({ frames, clip, button: btn, dpr: DPR }));
  console.log('clip desktop', frames, 'frames · botón en', Math.round(btn.x) + ',' + Math.round(btn.y));
  await ctx.close();
}

(async () => {
  fs.mkdirSync(path.join(OUT, 'clips'), { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const want = n => !only.length || only.includes(n);
  for (const def of CLIPS) if (want(def.name)) await runClip(browser, def);
  if (want('stills')) await runStills(browser);
  if (want('desktop')) await runDesktop(browser);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
