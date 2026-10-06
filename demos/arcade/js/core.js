/* ZAP Arcade · núcleo compartido
   Utilidades, ajustes, audio, lienzo y partículas, marcador, iconos pixel, perfil (récords, XP, logros), avisos y confeti. */
(() => {
'use strict';

const Z = window.ZAP = { games: {}, order: [], achs: [], ev: {} };
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[(Math.random() * a.length) | 0];
const lerp = (a, b, t) => a + (b - a) * t;
const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const canHover = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
Object.assign(Z, { $, $$, TAU, clamp, rand, randInt, pick, lerp, REDUCED, canHover });

Z.on = (n, f) => { (Z.ev[n] = Z.ev[n] || []).push(f); };
Z.emit = (n, a) => { (Z.ev[n] || []).forEach(f => { try { f(a); } catch (e) { console.error(e); } }); };

/* ---------- colores leídos de los tokens CSS ---------- */
const COL = {};
const PAL = ['ink', 'panel', 'line', 'text', 'muted', 'cyan', 'magenta', 'amber', 'lime', 'violet'];
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function readPalette() { PAL.forEach(n => { COL[n] = css('--' + n) || '#ffffff'; }); }
Z.COL = COL; Z.readPalette = readPalette;
Z.FD = "'Silkscreen','Courier New',monospace";
Z.FB = "'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace";

function hex(c) {
  c = c.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}
function mix(a, b, t) {
  const A = hex(a), B = hex(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
function rgba(c, a) { const [r, g, b] = hex(c); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; }
const easeOutBack = p => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
const easeOutCubic = p => 1 - Math.pow(1 - p, 3);
const easeOutBounce = x => {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + .75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + .9375;
  return n1 * (x -= 2.625 / d1) * x + .984375;
};
Object.assign(Z, { hex, mix, rgba, easeOutBack, easeOutCubic, easeOutBounce });
Z.pad5 = n => String(n).padStart(5, '0');
Z.fmtTime = s => (Number.isInteger(s) ? s : +s.toFixed(1)) + ' s';
Z.fmtDur = s => {
  s = Math.round(s);
  if (s < 60) return s + ' s';
  if (s < 3600) return Math.floor(s / 60) + ' min';
  return Math.floor(s / 3600) + ' h ' + String(Math.floor(s % 3600 / 60)).padStart(2, '0') + ' min';
};

/* ---------- almacenamiento (opcional, nunca rompe el juego) ---------- */
Z.store = {
  get(k, d) { try { const v = localStorage.getItem('zap-arcade:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('zap-arcade:' + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
  del(k) { try { localStorage.removeItem('zap-arcade:' + k); } catch (e) { /* nada */ } }
};
const store = Z.store;

/* ---------- ajustes del usuario ---------- */
Z.SKINS = [
  ['neon', 'Neón', ['#0b0d18', '#4df0ff', '#ff4d8d'], 0],
  ['matrix', 'Matrix', ['#050d08', '#39ff88', '#ff5a4d'], 0],
  ['sunset', 'Sunset', ['#150a16', '#ff9a4d', '#ff3d71'], 0],
  ['ice', 'Hielo', ['#e9eff9', '#0a74f0', '#e0245e'], 0],
  ['mono', 'Mono', ['#0c0c0c', '#ffffff', '#ff4a4a'], 0],
  ['candy', 'Candy', ['#fff1f7', '#ff4d9a', '#7c4dff'], 3],
  ['gameboy', 'Game Boy', ['#0f380f', '#9bbc0f', '#e0f8d0'], 5],
  ['vapor', 'Vapor', ['#12062b', '#00f0ff', '#ff2fb9'], 8],
  ['gold', 'Oro', ['#0e0b05', '#ffcb3d', '#ff6b3d'], 12]
];
Z.cfgDefaults = () => ({ skin: 'neon', accent: '', glass: true, tilt: canHover && !REDUCED, low: false, bg: 'orbs', crt: true, frame: 'glass', fx: 1, shake: true, vol: .6 });
const cfg = Z.cfg = Object.assign(Z.cfgDefaults(), store.get('cfg', {}));
if (!Z.SKINS.some(k => k[0] === cfg.skin)) cfg.skin = 'neon';
if (!/^#[0-9a-f]{6}$/i.test(cfg.accent || '')) cfg.accent = '';
if (!['orbs', 'grid', 'stars', 'none'].includes(cfg.bg)) cfg.bg = 'orbs';
if (!['glass', 'cabinet', 'neon'].includes(cfg.frame)) cfg.frame = 'glass';
cfg.fx = clamp(+cfg.fx | 0, 0, 2);
cfg.vol = clamp(+cfg.vol, 0, 1); if (isNaN(cfg.vol)) cfg.vol = .6;

/* ---------- sonido con WebAudio (se activa al interactuar) ---------- */
let actx = null, master = null;
Z.muted = store.get('muted', false);
function audio() {
  if (Z.muted || cfg.vol <= 0) return null;
  if (!actx) {
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); master = actx.createGain(); master.connect(actx.destination); } catch (e) { actx = null; return null; }
  }
  master.gain.value = cfg.vol;
  if (actx.state === 'suspended') actx.resume().catch(() => {});
  return actx;
}
function tone(f, d, type, v, slide, delay) {
  const a = audio(); if (!a) return;
  const t0 = a.currentTime + (delay || 0);
  const o = a.createOscillator(), g = a.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t0 + d);
  g.gain.setValueAtTime(v || .05, t0);
  g.gain.exponentialRampToValueAtTime(.0001, t0 + d);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + d + .02);
}
function noise(d, v, delay) {
  const a = audio(); if (!a) return;
  const len = Math.floor(a.sampleRate * d);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = a.createBufferSource(); s.buffer = buf;
  const g = a.createGain(); g.gain.value = v || .1;
  s.connect(g); g.connect(master);
  s.start(a.currentTime + (delay || 0));
}
const NOTES = [329.6, 415.3, 523.3, 659.3];
Z.audio = audio; Z.tone = tone; Z.noise = noise;
Z.sfx = {
  jump() { tone(280, .16, 'square', .05, 420); },
  land() { tone(120, .06, 'triangle', .05, -50); },
  point() { tone(880, .07, 'square', .04); tone(1320, .09, 'square', .04, 0, .07); },
  die() { tone(300, .5, 'sawtooth', .07, -260); noise(.35, .1); },
  reveal() { tone(520 + Math.random() * 80, .05, 'sine', .05); },
  cascade() { tone(420, .14, 'sine', .05, 420); },
  flag() { tone(660, .07, 'triangle', .07); tone(990, .07, 'triangle', .05, 0, .05); },
  boom() { noise(.5, .16); tone(90, .5, 'sawtooth', .07, -50); },
  pop() { noise(.12, .07); tone(140, .1, 'sawtooth', .04, -60); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .16, 'square', .05, 0, i * .1)); },
  eat() { tone(520, .06, 'square', .05, 300); },
  bonus() { [784, 988, 1175].forEach((f, i) => tone(f, .08, 'square', .05, 0, i * .06)); },
  turn() { tone(200, .025, 'square', .015); },
  hit() { tone(220, .05, 'square', .05); },
  bounce(f) { tone(f || 330, .06, 'square', .04); },
  brick(i) { tone(420 + (i || 0) * 45, .07, 'square', .05); },
  miss() { tone(220, .35, 'sawtooth', .06, -170); },
  rotate() { tone(520, .03, 'square', .03); },
  drop() { tone(150, .09, 'triangle', .08, -60); noise(.05, .04); },
  line(n) { [0, 1, 2, 3].slice(0, Math.min(4, n || 1) + 1).forEach((k, i) => tone(520 + k * 130, .1, 'square', .05, 0, i * .05)); },
  flip() { tone(700, .04, 'triangle', .04); },
  match() { tone(660, .08, 'triangle', .06); tone(990, .12, 'triangle', .06, 0, .07); },
  nomatch() { tone(180, .18, 'sawtooth', .04, -60); },
  laser() { tone(900, .12, 'square', .03, -700); },
  explode() { noise(.28, .12); tone(110, .28, 'sawtooth', .05, -70); },
  level() { [440, 554, 659, 880].forEach((f, i) => tone(f, .12, 'triangle', .06, 0, i * .07)); },
  click() { tone(600, .03, 'square', .03); },
  ach() { [659, 784, 988, 1319].forEach((f, i) => tone(f, .14, 'triangle', .06, 0, i * .08)); },
  swish() { noise(.08, .04); },
  tick() { tone(1000, .02, 'square', .02); },
  note(i, d) { tone(NOTES[i % 4], d || .28, 'sine', .14); },
  flap() { tone(330, .08, 'triangle', .05, 220); },
  drip(i) { tone(280 + (i || 0) * 30, .12, 'sine', .07, -90); }
};

/* ---------- lienzo, partículas, textos flotantes y sacudida ---------- */
const canvas = $('#cv');
const ctx = canvas.getContext('2d');
const screenEl = $('#screen');
const calcS = () => (cfg.low ? 1 : Math.min(2, window.devicePixelRatio || 1));
let S = calcS();
let shake = 0;
let forceDraw = true;
const parts = [], pops = [];
Z.canvas = canvas; Z.ctx = ctx; Z.parts = parts; Z.screenEl = screenEl;
Z.S = () => S;
Z.redraw = () => { forceDraw = true; };
Z.addShake = v => { if (!REDUCED && cfg.shake) shake = Math.max(shake, v); };
Z.clearFx = () => { parts.length = 0; pops.length = 0; shake = 0; };
let dimW = 720, dimH = 280;
/* limita el ancho para que la pantalla (sobre todo las verticales) quepa en la altura de la ventana */
function fitScreen() {
  const avail = Math.max(300, window.innerHeight - 340);
  screenEl.style.maxWidth = Math.round(Math.max(260, Math.min(dimW * 1.35, avail * dimW / dimH))) + 'px';
}
window.addEventListener('resize', fitScreen);
Z.sizeCanvas = (w, h) => {
  S = calcS(); forceDraw = true; dimW = w; dimH = h;
  canvas.width = Math.round(w * S);
  canvas.height = Math.round(h * S);
  fitScreen();
};
Z.burst = (x, y, n, color, o) => {
  o = o || {};
  const speed = o.speed || 240, life = o.life || .6, size = o.size || 3;
  const grav = o.grav == null ? 400 : o.grav, spread = o.spread || TAU, angle = o.angle || 0;
  const k = cfg.fx === 0 ? 0 : cfg.fx === 2 ? 1.6 : 1;
  n = Math.round(n * k / ((REDUCED || cfg.low) ? 3 : 1));
  if (parts.length > 500) return;
  for (let i = 0; i < n; i++) {
    const a = angle + (Math.random() - .5) * spread, s = rand(.3, 1) * speed;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(.5, 1) * life, max: life, size: rand(1, size) + .5, color, grav });
  }
};
Z.popText = (x, y, text, color, o) => {
  o = o || {};
  if (pops.length > 40) pops.shift();
  pops.push({ x, y, text: String(text), color: color || COL.amber, t: 0, life: o.life || .85, size: o.size || 15, vy: o.vy == null ? -55 : o.vy });
};
function updateFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { const lastP = parts.pop(); if (i < parts.length) parts[i] = lastP; continue; }
    p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
  }
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i];
    p.t += dt; p.y += p.vy * dt; p.vy *= Math.pow(.2, dt);
    if (p.t >= p.life) pops.splice(i, 1);
  }
}
function drawFx() {
  for (const p of parts) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  for (const p of pops) {
    const q = p.t / p.life, sc = q < .15 ? easeOutBack(q / .15) : 1;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(sc, sc);
    ctx.globalAlpha = clamp(1 - Math.max(0, q - .6) / .4, 0, 1);
    ctx.font = '800 ' + p.size + 'px ' + Z.FD; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = rgba(COL.ink, .8); ctx.strokeText(p.text, 0, 0);
    ctx.fillStyle = p.color; ctx.fillText(p.text, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
Z.txt = (s, x, y, o) => {
  o = o || {};
  ctx.font = ((o.w || '') + ' ' + (o.size || 14) + 'px ' + (o.font || Z.FB)).trim();
  ctx.textAlign = o.align || 'center';
  ctx.textBaseline = o.base || 'middle';
  ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
  ctx.fillStyle = o.color || COL.text;
  ctx.fillText(s, x, y);
  ctx.globalAlpha = 1;
};
Z.banner = (w, h, title, color, lines) => {
  ctx.fillStyle = rgba(COL.ink, .72);
  ctx.fillRect(-20, -20, w + 40, h + 40);
  const cy = h / 2 - lines.length * 12;
  Z.txt(title, w / 2, cy - 8, { font: Z.FD, size: Math.min(30, w / 13), color });
  lines.forEach((l, i) => Z.txt(l, w / 2, cy + 28 + i * 22, { size: 13, color: i === lines.length - 1 ? COL.muted : COL.text }));
};
Z.rr = (x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};
Z.announce = msg => { const s = $('#status'); if (s) s.textContent = msg; };

/* ---------- marcador (DOM) ---------- */
const hudEl = $('#hud');
let hudSpans = [];
Z.hud = {
  init(labels) {
    hudEl.innerHTML = '';
    hudSpans = labels.map(l => {
      const d = document.createElement('div'); d.className = 'stat';
      const k = document.createElement('span'); k.className = 'k'; k.textContent = l;
      const v = document.createElement('span'); v.className = 'v';
      d.append(k, v); hudEl.append(d);
      return v;
    });
    hudEl.classList.remove('swap'); void hudEl.offsetWidth; hudEl.classList.add('swap');
  },
  bump(i) { const s = hudSpans[i]; if (!s) return; s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump'); },
  set(i, val, bump) {
    const s = hudSpans[i], str = String(val);
    if (s && s.textContent !== str) { s.textContent = str; if (bump) Z.hud.bump(i); }
  }
};

/* ---------- botones táctiles ---------- */
function hold(el, down, up) {
  el.addEventListener('pointerdown', e => { e.preventDefault(); audio(); down && down(); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(n => el.addEventListener(n, () => up && up()));
}
Z.pad = {
  hold,
  buttons(el, list, always) {
    const d = document.createElement('div'); d.className = 'pad' + (always ? ' always' : '');
    list.forEach(b => {
      const x = document.createElement('button'); x.type = 'button';
      x.className = 'btn' + (b.cls ? ' ' + b.cls : '');
      x.textContent = b.label; x.setAttribute('aria-label', b.aria || b.label);
      if (b.id) x.id = b.id;
      if (b.click) x.addEventListener('click', () => { x.blur(); b.click(x); });
      else hold(x, b.down, b.up);
      d.append(x);
    });
    el.append(d); return d;
  },
  dpad(el, cb) {
    const d = document.createElement('div'); d.className = 'pad dpad'; d.setAttribute('aria-label', 'Control direccional');
    [['up', '↑', 'Arriba'], ['left', '←', 'Izquierda'], ['down', '↓', 'Abajo'], ['right', '→', 'Derecha']].forEach(([k, l, a]) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + k; b.textContent = l; b.setAttribute('aria-label', a);
      b.addEventListener('pointerdown', e => { e.preventDefault(); audio(); cb(k); });
      d.append(b);
    });
    el.append(d); return d;
  }
};

/* ---------- iconos pixel 10×10 (máscaras que adoptan el color del tema) ---------- */
Z.ICONS = {
  runner: ['...####...', '..######..', '..#..###..', '..######..', '...####...', '.#.####.#.', '#..####..#', '...#..#...', '..##..##..', '..#....#..'],
  sweeper: ['....##....', '.#..##..#.', '..######..', '.########.', '##########', '##########', '.########.', '..######..', '.#..##..#.', '....##....'],
  worm: ['..######..', '.##....##.', '.#........', '.##.......', '..######..', '.......##.', '........#.', '.#.....##.', '.##...##..', '..#####...'],
  breakout: ['##########', '#.##.##.##', '##########', '..........', '....##....', '....##....', '..........', '..........', '..######..', '..........'],
  pong: ['..........', '.#........', '.#......#.', '.#......#.', '.#..##..#.', '.#..##..#.', '........#.', '........#.', '..........', '..........'],
  tetris: ['..........', '.########.', '.########.', '.########.', '...####...', '...####...', '...####...', '..........', '..........', '..........'],
  g2048: ['##########', '#........#', '#.######.#', '#......#.#', '#.######.#', '#.#......#', '#.######.#', '#........#', '##########', '..........'],
  flappy: ['..........', '...####...', '..##..##..', '.######.#.', '########..', '#########.', '.######...', '..####....', '..........', '..........'],
  memory: ['.########.', '.#......#.', '.#.####.#.', '.#.#..#.#.', '.#....#.#.', '.#...#..#.', '.#..#...#.', '.#......#.', '.#..#...#.', '.########.'],
  simon: ['####..####', '####..####', '####..####', '####..####', '..........', '..........', '####..####', '####..####', '####..####', '####..####'],
  invaders: ['..#....#..', '...#..#...', '..######..', '.##.##.##.', '##########', '#.######.#', '#.#....#.#', '...##.##..', '..........', '..........'],
  whack: ['#...##...#', '.#.####.#.', '..######..', '###.##.###', '..######..', '###.##.###', '..######..', '.#.####.#.', '#..#..#..#', '..........'],
  connect4: ['.##.##.##.', '.##.##.##.', '..........', '.##.##.##.', '.##.##.##.', '..........', '.##.##.##.', '.##.##.##.', '..........', '..........'],
  heart: ['..........', '.###..###.', '##########', '##########', '##########', '.########.', '..######..', '...####...', '....##....', '..........'],
  skull: ['..######..', '.########.', '##########', '##..##..##', '##..##..##', '##########', '.###..###.', '..######..', '..#.##.#..', '..######..'],
  ghost: ['..######..', '.########.', '##########', '##.####.##', '##.####.##', '##########', '##########', '##########', '##.####.##', '#...##...#'],
  star: ['....##....', '....##....', '...####...', '##########', '.########.', '..######..', '..######..', '.###..###.', '.##....##.', '.#......#.'],
  bolt: ['......##..', '.....##...', '....##....', '...##.....', '..######..', '....##....', '...##.....', '..##......', '.##.......', '.#........'],
  crown: ['..........', '#...##...#', '##.####.##', '##.####.##', '##########', '##########', '.########.', '.########.', '..........', '..........'],
  lock: ['..######..', '.##....##.', '.#......#.', '.#......#.', '##########', '##########', '####..####', '####..####', '##########', '##########'],
  trophy: ['##########', '#.######.#', '#.######.#', '.########.', '..######..', '...####...', '....##....', '....##....', '..######..', '..######..']
};
Z.AVATARS = ['runner', 'sweeper', 'worm', 'breakout', 'pong', 'tetris', 'g2048', 'flappy', 'memory', 'simon', 'invaders', 'whack', 'connect4', 'heart', 'skull', 'ghost', 'star', 'bolt', 'crown'];
Z.iconCSS = () => {
  const c = document.createElement('canvas'); c.width = c.height = 80;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#000';
  let out = '';
  for (const k in Z.ICONS) {
    g.clearRect(0, 0, 80, 80);
    Z.ICONS[k].forEach((row, y) => { for (let x = 0; x < 10; x++) if (row[x] === '#') g.fillRect(x * 8, y * 8, 8, 8); });
    let url = '';
    try { url = c.toDataURL('image/png'); } catch (e) { url = ''; }
    if (url) out += '.ico-' + k + '{--m:url(' + url + ')}\n';
  }
  return out;
};
Z.icon = (name, color, size) => {
  const i = document.createElement('i'); i.className = 'ico ico-' + name; i.setAttribute('aria-hidden', 'true');
  if (color) i.style.setProperty('--c', color);
  if (size) i.style.setProperty('--s', size + 'px');
  return i;
};

/* ---------- avisos y confeti ---------- */
Z.toast = o => {
  const box = $('#toasts'); if (!box) return;
  const t = document.createElement('div'); t.className = 'toast ' + (o.kind || '');
  t.setAttribute('role', 'status');
  const txt = document.createElement('div');
  const b = document.createElement('b'); b.textContent = o.title;
  const s = document.createElement('span'); s.textContent = o.text || '';
  txt.append(b, s);
  t.append(Z.icon(o.icon || 'star'), txt);
  box.append(t);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 380); }, o.ms || 4200);
};
const fxc = $('#fx'), fctx = fxc.getContext('2d');
let conf = [], confRun = false, confLast = 0;
function fitFx() { fxc.width = window.innerWidth; fxc.height = window.innerHeight; }
fitFx(); window.addEventListener('resize', fitFx);
function confStep(now) {
  const dt = Math.min(.05, (now - confLast) / 1000); confLast = now;
  fctx.clearRect(0, 0, fxc.width, fxc.height);
  for (let i = conf.length - 1; i >= 0; i--) {
    const p = conf[i];
    p.life -= dt; p.vy += 520 * dt; p.vx *= Math.pow(.4, dt); p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
    if (p.life <= 0 || p.y > fxc.height + 20) { conf.splice(i, 1); continue; }
    fctx.save(); fctx.translate(p.x, p.y); fctx.rotate(p.r); fctx.globalAlpha = clamp(p.life * 2, 0, 1);
    fctx.fillStyle = p.c; fctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); fctx.restore();
  }
  if (conf.length) requestAnimationFrame(confStep); else { confRun = false; fctx.clearRect(0, 0, fxc.width, fxc.height); }
}
Z.confetti = (x, y, n) => {
  if (cfg.fx === 0 || REDUCED) return;
  x = x == null ? window.innerWidth / 2 : x; y = y == null ? window.innerHeight * .35 : y;
  n = Math.round((n || 90) / (cfg.low ? 3 : 1));
  const cols = [COL.cyan, COL.magenta, COL.amber, COL.lime, COL.violet];
  for (let i = 0; i < n; i++) {
    const a = rand(-Math.PI, 0), s = rand(180, 620);
    conf.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, w: rand(5, 10), h: rand(3, 6), r: rand(0, TAU), vr: rand(-9, 9), life: rand(1.4, 2.6), c: pick(cols) });
  }
  if (conf.length > 400) conf.splice(0, conf.length - 400);
  if (!confRun) { confRun = true; confLast = performance.now(); requestAnimationFrame(confStep); }
};

/* =====================================================================
   Registro de juegos, modos y métricas
   ===================================================================== */
Z.register = meta => {
  Z.games[meta.id] = meta; Z.order.push(meta.id);
  (meta.ach || []).forEach(a => Z.achs.push(Object.assign({ game: meta.id }, a)));
};
const DEF_METRIC = { label: 'Puntos', better: 'high', fmt: v => String(v) };
Z.metricOf = (gid, mid) => {
  const m = Z.games[gid]; if (!m) return DEF_METRIC;
  const mode = (m.modes || []).find(x => x.id === mid);
  return Object.assign({}, DEF_METRIC, m.metric || {}, (mode && mode.metric) || {});
};
Z.fmt = (v, gid, mid) => v == null ? '--' : Z.metricOf(gid, mid).fmt(v);
Z.modeName = (gid, mid) => { const m = Z.games[gid]; const x = m && m.modes.find(q => q.id === mid); return x ? x.name : mid; };
Z.modeFor = gid => {
  const m = Z.games[gid]; const saved = store.get('mode:' + gid, null);
  return m.modes.some(x => x.id === saved) ? saved : m.modes[0].id;
};

let cur = null;
Z.setCurrent = c => { cur = c; forceDraw = true; };
Z.cur = () => cur;

/* =====================================================================
   Perfil: récords, XP, nivel, logros, racha
   ===================================================================== */
const PKEY = 'profile';
const defProfile = () => ({ v: 1, name: 'Jugador', avatar: { ico: 'runner', col: 'cyan' }, created: Date.now(), xp: 0, time: 0, plays: 0, records: 0, visits: {}, games: {}, ach: {}, days: [] });
function migrateOld(P) {
  const bw = store.get('best-worm', 0), br = store.get('best-runner', 0), sw = store.get('sw-best', {});
  const put = (g, m, v) => {
    if (!v) return;
    const G = (P.games[g] = P.games[g] || { plays: 0, time: 0, last: 0, modes: {} });
    G.modes[m] = { plays: 1, best: v, hist: [v] };
  };
  put('runner', 'normal', br); put('worm', 'classic', bw);
  ['facil', 'medio', 'dificil'].forEach((m, i) => put('sweeper', m, sw[i]));
}
let P = store.get(PKEY, null);
if (!P || typeof P !== 'object' || !P.games) { P = defProfile(); migrateOld(P); }
['visits', 'games', 'ach'].forEach(k => { if (!P[k] || typeof P[k] !== 'object') P[k] = {}; });
if (!Array.isArray(P.days)) P.days = [];
if (!P.avatar || !Z.ICONS[P.avatar.ico]) P.avatar = { ico: 'runner', col: 'cyan' };
P.name = String(P.name || 'Jugador').slice(0, 16);
let lastResult = null, dirtySince = 0;

const total = L => 30 * (L - 1) * (L - 1);
function levelInfo(xp) {
  const lvl = Math.floor(Math.sqrt(Math.max(0, xp) / 30)) + 1;
  const a = total(lvl), b = total(lvl + 1);
  return { lvl, cur: xp - a, need: b - a, p: clamp((xp - a) / (b - a), 0, 1) };
}
const TITLES = [[1, 'Novato'], [2, 'Aprendiz'], [4, 'Jugador'], [6, 'Veterano'], [9, 'Pro'], [12, 'Maestro'], [16, 'Leyenda'], [20, 'Mítico']];
const titleOf = l => TITLES.reduce((t, x) => (l >= x[0] ? x[1] : t), 'Novato');
const dayKey = d => { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function addDay() {
  const k = dayKey();
  if (!P.days.includes(k)) { P.days.push(k); if (P.days.length > 90) P.days.shift(); }
}
function streak() {
  const set = new Set(P.days); let n = 0; const d = new Date();
  if (!set.has(dayKey(d))) d.setDate(d.getDate() - 1);
  while (set.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
const triedCount = () => Object.keys(P.visits).filter(k => Z.games[k]).length;
const modesPlayed = () => Object.values(P.games).reduce((a, g) => a + Object.values(g.modes).filter(m => m.plays > 0).length, 0);
function save() { store.set(PKEY, P); dirtySince = 0; }

const GEN = [
  { id: 'first', name: 'Primer contacto', desc: 'Termina tu primera partida', icon: 'bolt', test: p => p.plays >= 1, prog: p => [p.plays, 1] },
  { id: 'p10', name: 'Enganchado', desc: 'Juega 10 partidas', icon: 'heart', test: p => p.plays >= 10, prog: p => [p.plays, 10] },
  { id: 'p50', name: 'Sin frenos', desc: 'Juega 50 partidas', icon: 'star', test: p => p.plays >= 50, prog: p => [p.plays, 50] },
  { id: 'p200', name: 'Leyenda del arcade', desc: 'Juega 200 partidas', icon: 'crown', test: p => p.plays >= 200, prog: p => [p.plays, 200] },
  { id: 'try5', name: 'Curioso', desc: 'Prueba 5 juegos distintos', icon: 'ghost', test: () => triedCount() >= 5, prog: () => [triedCount(), 5] },
  { id: 'tryall', name: 'Explorador', desc: 'Prueba todos los juegos', icon: 'trophy', test: () => triedCount() >= Z.order.length, prog: () => [triedCount(), Z.order.length] },
  { id: 'modes10', name: 'Todoterreno', desc: 'Juega 10 modos distintos', icon: 'skull', test: () => modesPlayed() >= 10, prog: () => [modesPlayed(), 10] },
  { id: 'rec5', name: 'Cazarrécords', desc: 'Bate 5 récords', icon: 'trophy', test: p => p.records >= 5, prog: p => [p.records, 5] },
  { id: 'rec25', name: 'Coleccionista', desc: 'Bate 25 récords', icon: 'crown', test: p => p.records >= 25, prog: p => [p.records, 25] },
  { id: 'time10', name: 'Calentando', desc: 'Juega 10 minutos', icon: 'bolt', test: p => p.time >= 600, prog: p => [Math.floor(p.time / 60), 10] },
  { id: 'time60', name: 'Una hora bien gastada', desc: 'Juega 1 hora en total', icon: 'star', test: p => p.time >= 3600, prog: p => [Math.floor(p.time / 60), 60] },
  { id: 'lvl5', name: 'Veterano', desc: 'Alcanza el nivel 5', icon: 'crown', test: p => levelInfo(p.xp).lvl >= 5, prog: p => [levelInfo(p.xp).lvl, 5] },
  { id: 'streak3', name: 'Constante', desc: 'Juega 3 días seguidos', icon: 'heart', test: () => streak() >= 3, prog: () => [Math.min(3, streak()), 3] },
  { id: 'stylist', name: 'Estilista', desc: 'Cambia de tema', icon: 'star', manual: true },
  { id: 'custom', name: 'A tu manera', desc: 'Elige un color de acento propio', icon: 'ghost', manual: true },
  { id: 'avatar', name: 'Nueva identidad', desc: 'Cambia tu avatar', icon: 'skull', manual: true }
];
Z.achs.unshift(...GEN);

function grant(a) {
  if (P.ach[a.id]) return false;
  P.ach[a.id] = Date.now();
  P.xp += 25;
  Z.sfx.ach();
  Z.toast({ kind: 'ach', title: 'Logro desbloqueado', text: a.name, icon: a.icon || 'trophy' });
  return true;
}
function checkAch(r) {
  let any = false;
  for (const a of Z.achs) {
    if (P.ach[a.id] || a.manual || !a.test) continue;
    let ok = false;
    try { ok = a.test(P, r); } catch (e) { ok = false; }
    if (ok && grant(a)) any = true;
  }
  if (any) { save(); Z.emit('profile'); }
}

function submitFor(gid, mid, value, extra) {
  const meta = Z.games[gid]; if (!meta) return { isBest: false };
  extra = extra || {};
  const metric = Z.metricOf(gid, mid);
  const g = (P.games[gid] = P.games[gid] || { plays: 0, time: 0, last: 0, modes: {} });
  const m = (g.modes[mid] = g.modes[mid] || { plays: 0, best: null, hist: [] });
  const has = value != null && isFinite(value);
  const prev = m.best;
  let isBest = false;
  if (has && value > 0) isBest = prev == null || (metric.better === 'low' ? value < prev : value > prev);
  m.plays++; g.plays++; P.plays++; g.last = Date.now();
  if (has) { m.hist.push(value); if (m.hist.length > 30) m.hist.shift(); }
  if (isBest) { m.best = value; P.records++; }
  addDay();
  const before = levelInfo(P.xp).lvl;
  const gain = (has ? 10 : 6) + (isBest ? (prev == null ? 8 : 20) : 0) + (extra.xp || 0);
  P.xp += gain;
  lastResult = { game: gid, mode: mid, value: has ? value : null, extra, isBest };
  if (isBest && prev != null) {
    Z.sfx.level();
    Z.toast({ kind: 'rec', title: 'Nuevo récord', text: meta.name + ' · ' + Z.modeName(gid, mid) + ': ' + metric.fmt(value), icon: 'trophy' });
    Z.confetti();
  }
  const after = levelInfo(P.xp).lvl;
  if (after > before) {
    const unlocked = Z.SKINS.filter(s => s[3] > before && s[3] <= after).map(s => s[1]);
    setTimeout(() => {
      Z.sfx.win();
      Z.toast({ kind: 'lvl', title: 'Nivel ' + after + ' · ' + titleOf(after), text: unlocked.length ? 'Tema desbloqueado: ' + unlocked.join(', ') : '+' + gain + ' XP', icon: 'star', ms: 5200 });
      Z.confetti(null, null, 140);
    }, isBest && prev != null ? 900 : 0);
  }
  checkAch(lastResult);
  save();
  Z.emit('profile');
  return { isBest, prev, best: m.best, gain };
}

Z.profile = {
  get data() { return P; },
  level: () => levelInfo(P.xp),
  title: () => titleOf(levelInfo(P.xp).lvl),
  titleOf,
  streak,
  triedCount,
  modesPlayed,
  save,
  best(gid, mid) {
    const c = cur;
    gid = gid || (c && c.id); mid = mid || (c && c.mode);
    const g = P.games[gid]; const m = g && g.modes[mid];
    return m && m.best != null ? m.best : null;
  },
  submit(value, extra) { return cur ? submitFor(cur.id, cur.mode, value, extra) : { isBest: false }; },
  submitFor,
  visit(gid) { P.visits[gid] = (P.visits[gid] || 0) + 1; addDay(); checkAch(null); save(); },
  unlock(id) {
    const a = Z.achs.find(x => x.id === id);
    if (a && grant(a)) { save(); Z.emit('profile'); }
  },
  tick(dt) {
    if (!cur || document.hidden || performance.now() - Z.lastInput > 20000) return;
    P.time += dt;
    const g = (P.games[cur.id] = P.games[cur.id] || { plays: 0, time: 0, last: 0, modes: {} });
    g.time += dt; dirtySince += dt;
    if (dirtySince > 15) { save(); checkAch(null); }
  },
  set(o) {
    if (o.name != null) P.name = String(o.name).trim().slice(0, 16) || 'Jugador';
    if (o.avatar) P.avatar = Object.assign({}, P.avatar, o.avatar);
    save(); Z.emit('profile');
  },
  export() { return JSON.stringify({ app: 'zap-arcade', profile: P }, null, 1); },
  import(txt) {
    try {
      const o = JSON.parse(txt), p = o && o.profile;
      if (!p || typeof p !== 'object' || !p.games) return false;
      P = Object.assign(defProfile(), p);
      ['visits', 'games', 'ach'].forEach(k => { if (!P[k] || typeof P[k] !== 'object') P[k] = {}; });
      if (!Array.isArray(P.days)) P.days = [];
      if (!Z.ICONS[(P.avatar || {}).ico]) P.avatar = { ico: 'runner', col: 'cyan' };
      P.name = String(P.name || 'Jugador').slice(0, 16);
      save(); Z.emit('profile'); return true;
    } catch (e) { return false; }
  },
  reset() { P = defProfile(); save(); Z.emit('profile'); },
  unlockedSkin: id => { const s = Z.SKINS.find(k => k[0] === id); return !!s && levelInfo(P.xp).lvl >= s[3]; }
};

/* ---------- bucle principal ---------- */
Z.lastInput = performance.now();
['pointerdown', 'keydown', 'pointermove'].forEach(n => window.addEventListener(n, () => { Z.lastInput = performance.now(); }, { passive: true }));
let last = performance.now(), drewAnim = false;
function frame(now) {
  requestAnimationFrame(frame);
  if (!cur) { last = now; return; }
  if (cfg.low && now - last < 30) return;
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  Z.profile.tick(dt);
  ctx.setTransform(S, 0, 0, S, 0, 0);
  updateFx(dt);
  shake = Math.max(0, shake - 45 * dt);
  const g = cur.inst;
  g.update(dt);
  /* en reposo (p. ej. buscaminas sin animaciones) no se redibuja nada */
  const idle = !forceDraw && !parts.length && !pops.length && shake === 0 && g.idle && g.idle();
  if (idle && !drewAnim) return;
  drewAnim = !idle; forceDraw = false;
  ctx.save();
  if (shake > 0) ctx.translate(rand(-shake, shake) * .5, rand(-shake, shake) * .5);
  g.draw();
  drawFx();
  ctx.restore();
}
Z.start = () => requestAnimationFrame(frame);
})();
