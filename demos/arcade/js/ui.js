/* © 2026 euZAPUS · Todos los derechos reservados. Ver LICENSE. */
/* ZAP Arcade · interfaz: hub de juegos, navegación, ajustes y perfil */
(() => {
'use strict';
const Z = window.ZAP;
const { $, $$, cfg, store, COL, clamp, REDUCED, canHover } = Z;
const root = document.documentElement;
const canvas = Z.canvas, screenEl = Z.screenEl;

/* iconos pixel como máscaras CSS */
const iconStyle = document.createElement('style'); iconStyle.textContent = Z.iconCSS(); document.head.append(iconStyle);

function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) for (const k in props) {
    const v = props[k]; if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach(c => { if (c == null || c === false) return; e.append(c.nodeType ? c : document.createTextNode(String(c))); });
  return e;
}
const AV_COLS = { cyan: 'var(--cyan)', magenta: 'var(--magenta)', amber: 'var(--amber)', lime: 'var(--lime)', violet: 'var(--violet)' };
function avatar(size) {
  const a = Z.profile.data.avatar;
  return h('span', { class: 'avatar', style: '--as:' + (size || 32) + 'px;--ac:' + (AV_COLS[a.col] || AV_COLS.cyan) }, Z.icon(a.ico));
}
const metaList = () => Z.order.map(id => Z.games[id]);
const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b);

/* =====================================================================
   Navegación
   ===================================================================== */
const hubEl = $('#hub'), playEl = $('#play'), gridEl = () => $('#grid');
let cur = null;

function show(view) {
  hubEl.hidden = view !== 'hub'; playEl.hidden = view !== 'play';
}
function go(id) {
  const hash = id ? '#' + id : '#';
  if (location.hash === hash || (!id && !location.hash)) route(); else location.hash = hash;
}
function route() {
  const [id, mode] = location.hash.slice(1).split('/');
  if (id && Z.games[id]) openGame(id, mode); else showHub();
}
window.addEventListener('hashchange', route);

function showHub() {
  if (cur) { if (cur.inst.leave) cur.inst.leave(); cur = null; Z.setCurrent(null); Z.clearFx(); }
  show('hub'); refreshHub(); document.title = 'ZAP Arcade';
  window.scrollTo(0, 0);
}

function openGame(id, mode) {
  const meta = Z.games[id];
  if (cur && cur.inst.leave) cur.inst.leave();
  if (!meta.inst) { meta.inst = meta.create(Z); if (meta.inst.init) meta.inst.init(); }
  mode = meta.modes.some(m => m.id === mode) ? mode : Z.modeFor(id);
  cur = { id, meta, inst: meta.inst, mode };
  Z.setCurrent(cur); Z.clearFx();
  store.set('mode:' + id, mode); store.set('last', id);
  show('play');
  $('#gtitle').textContent = meta.name;
  $('.playbar').style.setProperty('--gc', 'var(--' + meta.color + ')');
  document.title = meta.name + ' · ZAP Arcade';
  $$('#dock button').forEach(b => b.setAttribute('aria-current', String(b.dataset.game === id)));
  buildModes(); buildSkins2();
  $('#hint').innerHTML = meta.hint || '';
  const pb = $('#padbox'); pb.innerHTML = '';
  if (cur.inst.controls) cur.inst.controls(pb);
  cur.inst.enter(mode);
  if (cur.inst.setSkin && meta.skins) cur.inst.setSkin(Z.skinFor(id));
  Z.sizeCanvas(cur.inst.W, cur.inst.H);
  screenEl.classList.remove('swap'); void screenEl.offsetWidth; screenEl.classList.add('swap');
  Z.profile.visit(id);
  try { history.replaceState(null, '', '#' + id + '/' + mode); } catch (e) { /* nada */ }
  updateModeDesc();
  try { canvas.focus({ preventScroll: true }); } catch (e) { /* nada */ }
  const dk = $('#dock button[aria-current="true"]'); if (dk && dk.scrollIntoView) dk.scrollIntoView({ block: 'nearest', inline: 'center' });
}

function buildModes() {
  const box = $('#modes'); box.innerHTML = '';
  cur.meta.modes.forEach(m => {
    const b = h('button', { class: 'mode', type: 'button', 'aria-pressed': String(m.id === cur.mode), 'data-mode': m.id, onclick: () => { Z.setMode(m.id); b.blur(); } }, m.name);
    box.append(b);
  });
}
/* estilos del juego (se desbloquean con el nivel) */
function buildSkins2() {
  const row = $('#skinrow'); row.innerHTML = '';
  if (!cur || !cur.meta.skins) { row.hidden = true; return; }
  row.hidden = false;
  const active = Z.skinFor(cur.id), lvl = Z.profile.level().lvl;
  row.append(h('span', { class: 'k' }, 'Estilo'));
  cur.meta.skins.forEach(s => {
    const locked = (s.lvl || 0) > lvl;
    row.append(h('button', { type: 'button', class: 'mode sk' + (locked ? ' locked' : ''), 'aria-pressed': String(s.id === active), 'aria-disabled': locked ? 'true' : null, title: locked ? 'Se desbloquea en el nivel ' + s.lvl : s.name, 'data-skin': s.id,
      onclick: e => { Z.setSkin(s.id); e.currentTarget.blur(); } }, s.name, locked ? h('small', null, ' Nv ' + s.lvl) : null));
  });
}
Z.setSkin = id => {
  if (!cur || !cur.meta.skins) return;
  const s = cur.meta.skins.find(x => x.id === id); if (!s) return;
  if ((s.lvl || 0) > Z.profile.level().lvl) { Z.sfx.nomatch(); Z.toast({ kind: 'lvl', title: 'Estilo bloqueado', text: s.name + ' se desbloquea en el nivel ' + s.lvl, icon: 'lock' }); return; }
  store.set('skin:' + cur.id, id);
  if (cur.inst.setSkin) cur.inst.setSkin(id);
  buildSkins2(); Z.sfx.click(); Z.profile.unlock('skinner');
};
function updateModeDesc() {
  if (!cur) return;
  const m = cur.meta.modes.find(x => x.id === cur.mode), best = Z.profile.best();
  const d = $('#modedesc'); d.textContent = '';
  d.append(m.desc);
  if (best != null) d.append('  ', h('b', null, 'Récord: ' + Z.fmt(best, cur.id, cur.mode)));
}
Z.setMode = id => {
  if (!cur || cur.mode === id || !cur.meta.modes.some(m => m.id === id)) return;
  cur.mode = id; store.set('mode:' + cur.id, id);
  Z.clearFx();
  cur.inst.setMode(id);
  Z.sizeCanvas(cur.inst.W, cur.inst.H);
  $$('#modes .mode').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === id)));
  screenEl.classList.remove('swap'); void screenEl.offsetWidth; screenEl.classList.add('swap');
  updateModeDesc();
  Z.announce('Modo ' + Z.modeName(cur.id, id));
  try { history.replaceState(null, '', '#' + cur.id + '/' + id); } catch (e) { /* nada */ }
  try { canvas.focus({ preventScroll: true }); } catch (e) { /* nada */ }
};

/* =====================================================================
   Hub
   ===================================================================== */
let filter = store.get('filter', 'Todos');
function buildHub() {
  const genres = ['Todos'].concat(Array.from(new Set(metaList().map(m => m.genre))));
  if (!genres.includes(filter)) filter = 'Todos';
  hubEl.innerHTML = '';
  hubEl.append(
    h('section', { class: 'hero' },
      h('button', { class: 'cont panel-card glass', id: 'contBtn', type: 'button' }),
      h('button', { class: 'lvlcard panel-card glass', id: 'lvlCard', type: 'button', 'aria-label': 'Abrir mi perfil', onclick: () => openProfile('resumen') })
    ),
    h('div', { class: 'filters', id: 'filters', role: 'group', 'aria-label': 'Filtrar por género' },
      genres.map(g => h('button', { class: 'fchip', type: 'button', 'aria-pressed': String(g === filter), 'data-g': g, onclick: () => setFilter(g) }, g)),
      h('span', { class: 'sp' }),
      h('button', { class: 'btn sm', type: 'button', id: 'surprise', onclick: surprise }, '🎲 Sorpréndeme')
    ),
    h('section', { class: 'grid', id: 'grid', 'aria-label': 'Juegos' },
      metaList().map((m, i) => h('button', { class: 'gcard glass', type: 'button', 'data-game': m.id, 'data-g': m.genre, 'data-c': m.color, style: '--i:' + i, 'aria-label': m.name, onclick: () => go(m.id) },
        h('span', { class: 'hd' }, Z.icon(m.icon), h('span', { class: 'bd' })),
        h('h3', null, m.name),
        h('p', null, m.tag),
        h('span', { class: 'meta' })
      ))
    )
  );
  applyFilter();
}
function setFilter(g) {
  filter = g; store.set('filter', g);
  $$('#filters .fchip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.g === g)));
  applyFilter();
}
function applyFilter() {
  let n = 0;
  $$('#grid .gcard').forEach(c => { const out = filter !== 'Todos' && c.dataset.g !== filter; c.classList.toggle('out', out); if (!out) { c.style.setProperty('--i', n++); c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; } });
}
function surprise() {
  const P = Z.profile.data, fresh = Z.order.filter(id => !P.visits[id]);
  const pool = fresh.length ? fresh : Z.order, id = pool[(Math.random() * pool.length) | 0];
  Z.sfx.click(); go(id);
}
function refreshHub() {
  const P = Z.profile.data;
  // tarjeta de "continuar"
  const last = store.get('last', null), id = Z.games[last] ? last : 'runner', m = Z.games[id], mode = Z.modeFor(id), played = !!Z.games[last];
  const cb = $('#contBtn'); if (!cb) return;
  cb.style.setProperty('--gc', 'var(--' + m.color + ')'); cb.onclick = () => go(id);
  cb.innerHTML = '';
  const best = Z.profile.best(id, mode);
  cb.append(
    h('span', { class: 'k' }, played ? 'Continuar jugando' : 'Empieza aquí'),
    h('span', { class: 'top' }, Z.icon(m.icon), h('span', null, h('h2', null, m.name), h('p', null, Z.modeName(id, mode) + (best != null ? ' · récord ' + Z.fmt(best, id, mode) : ' · sin récord todavía')))),
    h('p', null, m.tag + '. Pulsa para jugar.')
  );
  // tarjeta de nivel
  const L = Z.profile.level(), lc = $('#lvlCard'); lc.innerHTML = '';
  const done = Object.keys(P.ach).filter(k => Z.achs.some(a => a.id === k)).length;
  lc.append(
    h('span', { class: 'ring', style: '--p:0' }, h('b', null, L.lvl), (() => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 64 64'); s.innerHTML = '<circle class="bgc" cx="32" cy="32" r="28"></circle><circle class="fg" cx="32" cy="32" r="28"></circle>'; return s; })()),
    h('span', { class: 't' }, P.name + ' · ' + Z.profile.title()),
    h('span', { class: 'k' }, Math.floor(L.cur) + ' / ' + L.need + ' XP al siguiente nivel'),
    h('span', { class: 'minis' },
      h('span', null, h('span', { class: 'k' }, 'Partidas'), h('b', null, P.plays)),
      h('span', null, h('span', { class: 'k' }, 'Tiempo'), h('b', null, Z.fmtDur(P.time))),
      h('span', null, h('span', { class: 'k' }, 'Logros'), h('b', null, done + '/' + Z.achs.length)),
      h('span', null, h('span', { class: 'k' }, 'Racha'), h('b', null, Z.profile.streak() + ' d'))
    )
  );
  requestAnimationFrame(() => { const r = lc.querySelector('.ring'); if (r) r.style.setProperty('--p', L.p.toFixed(3)); });
  // tarjetas de juego
  $$('#grid .gcard').forEach(c => {
    const gid = c.dataset.game, g = P.games[gid], gm = Z.games[gid], md = Z.modeFor(gid), b = Z.profile.best(gid, md);
    const bd = c.querySelector('.bd'); bd.innerHTML = '';
    if (!P.visits[gid] && !(g && g.plays)) bd.append(h('span', { class: 'badge new' }, 'Nuevo'));
    else bd.append(h('span', { class: 'badge' }, plural(gm.modes.length, 'modo', 'modos')));
    const me = c.querySelector('.meta'); me.innerHTML = '';
    me.append(b != null ? h('span', null, 'Récord · ' + Z.modeName(gid, md) + ': ', h('b', null, Z.fmt(b, gid, md))) : h('span', null, 'Sin récord'));
    if (g && g.plays) me.append(h('span', null, plural(g.plays, 'partida', 'partidas')));
  });
  $('#tagline').textContent = Z.order.length + ' juegos hechos a mano con HTML, Canvas y JavaScript puro. Sin librerías ni imágenes.';
  const pb = $('#profBtn'); pb.innerHTML = '';
  pb.append(avatar(32), h('span', null, h('b', null, P.name), h('small', null, 'Nv ' + L.lvl + ' · ' + Z.profile.title())));
}
/* inclinación 3D y foco bajo el cursor en las tarjetas */
hubEl.addEventListener('pointermove', e => {
  const c = e.target.closest && e.target.closest('.gcard'); if (!c || e.pointerType !== 'mouse') return;
  const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  c.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); c.style.setProperty('--my', (y * 100).toFixed(1) + '%');
  if (root.dataset.tilt === 'on') { c.style.setProperty('--ry', ((x - .5) * 10).toFixed(2) + 'deg'); c.style.setProperty('--rx', ((.5 - y) * 10).toFixed(2) + 'deg'); }
});
hubEl.addEventListener('pointerout', e => { const c = e.target.closest && e.target.closest('.gcard'); if (c && !c.contains(e.relatedTarget)) { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); } });

/* dock de cambio rápido */
Z.order.forEach(id => {
  const m = Z.games[id];
  $('#dock').append(h('button', { type: 'button', 'data-game': id, title: m.name, 'aria-label': m.name, onclick: () => go(id) }, Z.icon(m.icon)));
});
$('#back').addEventListener('click', () => go(''));
$('#home').addEventListener('click', () => go(''));

/* =====================================================================
   Entrada: puntero y teclado
   ===================================================================== */
/* offsetX/offsetY son coordenadas locales: siguen siendo exactas aunque la tarjeta esté inclinada en 3D */
function pos(e) { return { x: e.offsetX * (cur.inst.W / canvas.clientWidth), y: e.offsetY * (cur.inst.H / canvas.clientHeight) }; }
canvas.addEventListener('pointerdown', e => {
  if (!cur) return;
  try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* nada */ }
  Z.audio();
  if (cur.inst.down) cur.inst.down(pos(e), e);
});
canvas.addEventListener('pointermove', e => { if (cur && cur.inst.move) cur.inst.move(pos(e), e); });
canvas.addEventListener('pointerup', e => { if (cur && cur.inst.up) cur.inst.up(pos(e), e); });
canvas.addEventListener('pointercancel', e => { if (!cur) return; if (cur.inst.leaveCanvas) cur.inst.leaveCanvas(); if (cur.inst.cancel) cur.inst.cancel(); else if (cur.inst.up) cur.inst.up(pos(e), e); });
canvas.addEventListener('pointerleave', () => { if (cur && cur.inst.leaveCanvas) cur.inst.leaveCanvas(); });
canvas.addEventListener('contextmenu', e => e.preventDefault());

const panel = $('#settings'), cfgBtn = $('#cfgBtn');
let modalEl = null;
const typing = t => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
window.addEventListener('keydown', e => {
  if (e.code === 'Escape') {
    if (modalEl) { closeProfile(); return; }
    if (!panel.hidden) { setPanel(false); cfgBtn.focus(); return; }
  }
  if (e.metaKey || e.ctrlKey || e.altKey || !cur || modalEl) return;
  if (panel.contains(e.target) || typing(e.target)) return;
  Z.audio();
  if (cur.inst.key && cur.inst.key(e, true)) e.preventDefault();
});
window.addEventListener('keyup', e => {
  if (!cur || modalEl || panel.contains(e.target) || typing(e.target)) return;
  if (cur.inst.key && cur.inst.key(e, false)) e.preventDefault();
});
const blurGame = () => { if (cur && cur.inst.blur) cur.inst.blur(); };
document.addEventListener('visibilitychange', () => { if (document.hidden) blurGame(); });
window.addEventListener('blur', blurGame);

/* sonido */
const snd = $('#snd');
function syncSnd() { snd.setAttribute('aria-pressed', String(!Z.muted)); snd.textContent = 'Sonido: ' + (Z.muted ? 'no' : 'sí'); }
snd.addEventListener('click', () => { Z.muted = !Z.muted; store.set('muted', Z.muted); syncSnd(); if (!Z.muted) Z.sfx.point(); snd.blur(); });
syncSnd();

/* =====================================================================
   Ajustes
   ===================================================================== */
function setPanel(open) {
  panel.hidden = !open; cfgBtn.setAttribute('aria-expanded', String(open));
  if (open) { blurGame(); const f = panel.querySelector('button,input'); if (f) f.focus(); }
}
const seg = (key, opts) => h('div', { class: 'seg', role: 'group' }, opts.map(([v, label]) => h('button', { type: 'button', 'data-key': key, 'data-v': String(v), 'aria-pressed': 'false', onclick: () => { cfg[key] = v; applyCfg(key === 'low'); } }, label)));
const chk = (key, label) => h('label', { class: 'opt' }, h('input', { type: 'checkbox', id: 'opt-' + key, onchange: e => { cfg[key] = e.target.checked; applyCfg(key === 'low'); } }), h('span', null, label));
panel.append(
  h('div', { class: 'grp' }, h('span', { class: 'k' }, 'Tema'), h('div', { class: 'skins', id: 'skins' })),
  h('div', { class: 'grp' }, h('span', { class: 'k' }, 'Color de acento'), h('div', { class: 'row' }, h('input', { type: 'color', id: 'accent', 'aria-label': 'Color de acento' }), h('button', { class: 'btn sm', id: 'accentReset', type: 'button' }, 'Restablecer'))),
  h('div', { class: 'grp' }, h('span', { class: 'k' }, 'Fondo'), seg('bg', [['orbs', 'Orbes'], ['grid', 'Rejilla retro'], ['stars', 'Estrellas'], ['none', 'Liso']])),
  h('div', { class: 'grp' }, h('span', { class: 'k' }, 'Marco de la pantalla'), seg('frame', [['glass', 'Cristal'], ['cabinet', 'Recreativa'], ['neon', 'Neón']])),
  h('div', { class: 'grp' }, h('span', { class: 'k' }, 'Partículas'), seg('fx', [[0, 'Sin'], [1, 'Normal'], [2, 'Muchas']])),
  h('div', { class: 'grp' }, h('span', { class: 'k' }, 'Efectos'),
    chk('glass', 'Cristal y desenfoque'), chk('tilt', 'Inclinación 3D con el ratón'), chk('crt', 'Efecto CRT (líneas y viñeta)'), chk('shake', 'Sacudidas de pantalla'), chk('low', 'Bajo consumo (menos efectos, 30 FPS)')),
  h('div', { class: 'grp' }, h('label', { class: 'k', for: 'vol' }, 'Volumen'), h('input', { type: 'range', id: 'vol', min: '0', max: '1', step: '.05', 'aria-label': 'Volumen', oninput: e => { cfg.vol = +e.target.value; applyCfg(); }, onchange: () => Z.sfx.point() })),
  h('div', { class: 'row' }, h('button', { class: 'btn sm danger', type: 'button', onclick: () => { Object.assign(cfg, Z.cfgDefaults()); applyCfg(true); } }, 'Restablecer ajustes'))
);
const skinsEl = $('#skins'), accentEl = $('#accent');
function buildSkins() {
  skinsEl.innerHTML = '';
  Z.SKINS.forEach(([id, name, c, lvl]) => {
    const locked = !Z.profile.unlockedSkin(id);
    const dot = h('i', { style: 'background:linear-gradient(135deg,' + c[0] + ' 0 34%,' + c[1] + ' 34% 67%,' + c[2] + ' 67% 100%)' });
    const b = h('button', {
      type: 'button', class: 'skin' + (locked ? ' locked' : ''), 'data-skin': id, 'aria-pressed': String(cfg.skin === id), 'aria-disabled': locked ? 'true' : null,
      title: locked ? 'Se desbloquea en el nivel ' + lvl : name,
      onclick: () => {
        if (!Z.profile.unlockedSkin(id)) { Z.sfx.nomatch(); Z.toast({ kind: 'lvl', title: 'Tema bloqueado', text: name + ' se desbloquea en el nivel ' + lvl, icon: 'lock' }); return; }
        cfg.skin = id; cfg.accent = ''; applyCfg(); Z.profile.unlock('stylist');
      }
    }, dot, name, locked ? h('small', null, ' Nv ' + lvl) : null);
    skinsEl.append(b);
  });
}
function syncSettingsUI() {
  buildSkins();
  $$('.seg button').forEach(b => b.setAttribute('aria-pressed', String(String(cfg[b.dataset.key]) === b.dataset.v)));
  accentEl.value = /^#[0-9a-f]{6}$/i.test(COL.cyan) ? COL.cyan.toLowerCase() : '#4df0ff';
  ['glass', 'tilt', 'crt', 'shake', 'low'].forEach(k => { $('#opt-' + k).checked = !!cfg[k]; });
  $('#opt-glass').disabled = cfg.low; $('#opt-tilt').disabled = cfg.low || !canHover; $('#opt-crt').disabled = cfg.low;
  $('#vol').value = cfg.vol;
}
function applyCfg(resize) {
  if (!Z.profile.unlockedSkin(cfg.skin)) cfg.skin = 'neon';
  root.dataset.skin = cfg.skin;
  if (cfg.accent) root.style.setProperty('--cyan', cfg.accent); else root.style.removeProperty('--cyan');
  root.dataset.glass = cfg.glass && !cfg.low ? 'on' : 'off';
  root.dataset.tilt = cfg.tilt && !cfg.low && !REDUCED && canHover ? 'on' : 'off';
  root.dataset.low = cfg.low ? 'on' : 'off';
  root.dataset.bg = cfg.bg; root.dataset.frame = cfg.frame; root.dataset.crt = cfg.crt ? 'on' : 'off';
  Z.readPalette();
  metaList().forEach(m => { if (m.inst && m.inst.recolor) m.inst.recolor(); });
  if (resize && cur) Z.sizeCanvas(cur.inst.W, cur.inst.H);
  Z.redraw();
  syncSettingsUI();
  store.set('cfg', cfg);
}
cfgBtn.addEventListener('click', () => setPanel(panel.hidden));
document.addEventListener('pointerdown', e => { if (!panel.hidden && !panel.contains(e.target) && !cfgBtn.contains(e.target)) setPanel(false); });
accentEl.addEventListener('input', () => { cfg.accent = accentEl.value; applyCfg(); Z.profile.unlock('custom'); });
$('#accentReset').addEventListener('click', () => { cfg.accent = ''; applyCfg(); });

/* inclinación 3D de la tarjeta de juego (solo ratón; sobre la pantalla se atenúa) */
const stageEl = $('.stage');
let tiltPending = false, tpx = 0, tpy = 0, tTarget = null;
function applyTilt() {
  tiltPending = false;
  const k = tTarget === canvas ? .25 : 1;
  const nx = (tpx / window.innerWidth - .5) * 2, ny = (tpy / window.innerHeight - .5) * 2;
  const r = stageEl.getBoundingClientRect();
  stageEl.style.setProperty('--ry', (nx * 6 * k).toFixed(2) + 'deg');
  stageEl.style.setProperty('--rx', (-ny * 4 * k).toFixed(2) + 'deg');
  stageEl.style.setProperty('--mx', clamp((tpx - r.left) / r.width * 100, 0, 100).toFixed(1) + '%');
  stageEl.style.setProperty('--my', clamp((tpy - r.top) / r.height * 100, 0, 100).toFixed(1) + '%');
}
window.addEventListener('pointermove', e => {
  if (root.dataset.tilt !== 'on' || e.pointerType !== 'mouse' || playEl.hidden) return;
  tpx = e.clientX; tpy = e.clientY; tTarget = e.target;
  if (!tiltPending) { tiltPending = true; requestAnimationFrame(applyTilt); }
});
root.addEventListener('mouseleave', () => { stageEl.style.setProperty('--rx', '0deg'); stageEl.style.setProperty('--ry', '0deg'); });

/* estrellas del fondo: sombras generadas una vez, duplicadas 100vh más abajo para que el bucle sea continuo */
$$('.stars i').forEach((s, n) => {
  const count = [50, 24, 90][n], sh = [];
  for (let i = 0; i < count; i++) {
    const x = (Math.random() * 100).toFixed(1), y = Math.random() * 100, c = Math.random() < .3 ? 'var(--cyan)' : 'var(--text)';
    sh.push(x + 'vw ' + y.toFixed(1) + 'vh 0 0 ' + c, x + 'vw ' + (y + 100).toFixed(1) + 'vh 0 0 ' + c);
  }
  s.style.boxShadow = sh.join(',');
});

/* =====================================================================
   Perfil
   ===================================================================== */
const TABS = [['resumen', 'Resumen'], ['records', 'Récords'], ['logros', 'Logros'], ['editar', 'Editar']];
let tab = 'resumen', lastFocus = null;
function countUp(el, to, fmt) {
  fmt = fmt || (v => String(v));
  if (REDUCED || !isFinite(to)) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), dur = 700;
  (function step(now) {
    const q = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - q, 3);
    el.textContent = fmt(Math.round(to * e));
    if (q < 1 && el.isConnected) requestAnimationFrame(step); else el.textContent = fmt(to);
  })(t0);
}
function openProfile(t) {
  if (modalEl) { renderTab(t || tab); return; }
  tab = t || tab; lastFocus = document.activeElement; blurGame(); setPanel(false);
  const body = h('div', { class: 'dbody', id: 'dbody', role: 'tabpanel' });
  const tabs = h('div', { class: 'tabs2', role: 'tablist' }, TABS.map(([id, name]) => h('button', { type: 'button', role: 'tab', 'data-tab': id, 'aria-selected': 'false', onclick: () => renderTab(id) }, name)));
  const close = h('button', { class: 'btn sm', type: 'button', 'aria-label': 'Cerrar perfil', onclick: closeProfile }, 'Cerrar ✕');
  const dlg = h('div', { class: 'dlg glass', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Perfil' }, h('div', { class: 'bar' }, h('h2', null, 'Mi perfil'), close), tabs, body);
  modalEl = h('div', { class: 'modal', onpointerdown: e => { if (e.target === modalEl) closeProfile(); } }, dlg);
  modalEl.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const f = $$('.modal button, .modal input, .modal summary, .modal [tabindex="0"]').filter(x => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  document.body.append(modalEl);
  renderTab(tab); close.focus();
}
function closeProfile() {
  if (!modalEl) return;
  const m = modalEl; modalEl = null; m.style.animation = 'fadeIn .2s reverse both'; setTimeout(() => m.remove(), 180);
  if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) { /* nada */ }
}
Z.on('profile', () => {
  refreshHubSafe(); syncSettingsUI(); updateModeDesc(); if (cur) buildSkins2();
  if (modalEl && tab !== 'editar') renderTab(tab);
});
function refreshHubSafe() { if (!hubEl.hidden) refreshHub(); else { const pb = $('#profBtn'); const P = Z.profile.data, L = Z.profile.level(); pb.innerHTML = ''; pb.append(avatar(32), h('span', null, h('b', null, P.name), h('small', null, 'Nv ' + L.lvl + ' · ' + Z.profile.title()))); } }

function renderTab(id) {
  tab = id;
  $$('.tabs2 button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
  const body = $('#dbody'); if (!body) return;
  const keep = body.scrollTop; body.innerHTML = '';
  ({ resumen: tabResumen, records: tabRecords, logros: tabLogros, editar: tabEditar })[id](body);
  body.scrollTop = keep;
}
function tabResumen(body) {
  const P = Z.profile.data, L = Z.profile.level();
  const done = Object.keys(P.ach).filter(k => Z.achs.some(a => a.id === k)).length;
  const xpbar = h('i'); const bar = h('div', { class: 'xp', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(L.need), 'aria-valuenow': String(Math.floor(L.cur)) }, xpbar);
  body.append(h('div', { class: 'who' }, avatar(76), h('div', { style: 'display:grid;gap:4px;min-width:0;flex:1' },
    h('h3', null, P.name), h('span', { class: 'ttl' }, 'NIVEL ' + L.lvl + ' · ' + Z.profile.title().toUpperCase()), bar,
    h('span', { class: 'k' }, Math.floor(L.cur) + ' / ' + L.need + ' XP · ' + P.xp + ' XP totales'))));
  requestAnimationFrame(() => requestAnimationFrame(() => xpbar.style.setProperty('--p', L.p.toFixed(3))));
  const stat = (k, v, fmt) => { const b = h('b', null, '0'); const el = h('div', { class: 'sc' }, h('span', { class: 'k' }, k), b); setTimeout(() => countUp(b, v, fmt), 60); return el; };
  body.append(h('div', { class: 'stats' },
    stat('Partidas', P.plays), stat('Tiempo jugado', Math.round(P.time), Z.fmtDur), stat('Récords batidos', P.records),
    stat('Juegos probados', Z.profile.triedCount(), v => v + '/' + Z.order.length), stat('Logros', done, v => v + '/' + Z.achs.length), stat('Racha de días', Z.profile.streak())));
  const rows = Z.order.map(id => ({ id, time: (P.games[id] || {}).time || 0, plays: (P.games[id] || {}).plays || 0 })).filter(r => r.time > 1 || r.plays).sort((a, b) => b.time - a.time);
  const max = Math.max(1, ...rows.map(r => r.time));
  body.append(h('div', { class: 'grp' }, h('span', { class: 'k' }, 'Tiempo por juego'),
    rows.length ? h('div', { class: 'bars' }, rows.map(r => { const m = Z.games[r.id]; const fill = h('i'); setTimeout(() => fill.style.setProperty('--p', (r.time / max).toFixed(3)), 80);
      return h('div', { class: 'barrow', style: '--gc:var(--' + m.color + ')' }, h('span', null, m.name), h('span', { class: 't' }, fill), h('span', null, Z.fmtDur(r.time))); }))
      : h('p', { class: 'hint' }, 'Todavía no has jugado. Elige un juego y tus estadísticas aparecerán aquí.')));
}
function spark(hist, better) {
  const hh = hist.slice(-20); if (hh.length < 2) return h('span');
  const w = 110, ht = 28, pad = 3, min = Math.min(...hh), max = Math.max(...hh), span = (max - min) || 1, low = better === 'low';
  const pts = hh.map((v, i) => [pad + i * (w - 2 * pad) / (hh.length - 1), low ? pad + (v - min) / span * (ht - 2 * pad) : ht - pad - (v - min) / span * (ht - 2 * pad)]);
  const bi = hh.lastIndexOf(low ? min : max), s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('class', 'spark'); s.setAttribute('viewBox', '0 0 110 28'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<polyline points="' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + '"></polyline><circle cx="' + pts[bi][0].toFixed(1) + '" cy="' + pts[bi][1].toFixed(1) + '" r="3"></circle>';
  return s;
}
function tabRecords(body) {
  const P = Z.profile.data; let opened = false;
  Z.order.forEach(id => {
    const m = Z.games[id], g = P.games[id], any = !!(g && g.plays);
    const top = any ? Object.entries(g.modes).filter(([, x]) => x.best != null).sort((a, b) => b[1].plays - a[1].plays)[0] : null;
    const d = h('details', { class: 'rec', 'data-c': m.color, open: any && !opened ? true : null },
      h('summary', null, Z.icon(m.icon), h('b', null, m.name), h('small', null, any ? plural(g.plays, 'partida', 'partidas') + ' · ' + Z.fmtDur(g.time || 0) + (top ? ' · ' + Z.modeName(id, top[0]) + ': ' + Z.fmt(top[1].best, id, top[0]) : '') : 'Sin jugar')),
      m.modes.map(md => {
        const x = g && g.modes[md.id], metric = Z.metricOf(id, md.id);
        return h('div', { class: 'mrow' + (x && x.plays ? '' : ' none'), style: '--gc:var(--' + m.color + ')' },
          h('span', null, md.name), h('span', { class: 'best', title: metric.label }, x && x.best != null ? metric.fmt(x.best) : '--'),
          h('span', { title: 'Partidas' }, x ? x.plays + '×' : '0×'), x && x.hist ? spark(x.hist, metric.better) : h('span'));
      }),
      h('div', { class: 'mrow', style: 'grid-template-columns:1fr' }, h('button', { class: 'btn sm', type: 'button', onclick: () => { closeProfile(); go(id); } }, 'Jugar ' + m.name))
    );
    if (any && !opened) opened = true;
    body.append(d);
  });
}
function tabLogros(body) {
  const P = Z.profile.data;
  const got = Z.achs.filter(a => P.ach[a.id]).length;
  body.append(h('p', { class: 'hint' }, got + ' de ' + Z.achs.length + ' logros desbloqueados. Cada logro da +25 XP.'));
  const list = Z.achs.slice().sort((a, b) => (P.ach[b.id] ? 1 : 0) - (P.ach[a.id] ? 1 : 0));
  body.append(h('div', { class: 'achs' }, list.map(a => {
    const has = !!P.ach[a.id]; let pr = null;
    if (!has && a.prog) { try { pr = a.prog(P); } catch (e) { pr = null; } }
    const gm = a.game ? Z.games[a.game] : null;
    return h('div', { class: 'ach' + (has ? ' got' : '') }, Z.icon(has ? (a.icon || 'trophy') : 'lock'), h('b', null, a.name),
      h('small', null, a.desc + (has ? ' · ' + new Date(P.ach[a.id]).toLocaleDateString('es') : gm ? '' : '')),
      pr ? h('span', { class: 'pg', 'aria-label': pr[0] + ' de ' + pr[1] }, h('i', { style: '--p:' + clamp(pr[0] / pr[1], 0, 1).toFixed(3) })) : null);
  })));
}
function tabEditar(body) {
  const P = Z.profile.data;
  const name = h('input', { type: 'text', id: 'pname', maxlength: '16', value: P.name, 'aria-label': 'Nombre', autocomplete: 'off', onchange: e => { Z.profile.set({ name: e.target.value }); e.target.value = Z.profile.data.name; document.title = 'ZAP Arcade'; } });
  body.append(h('div', { class: 'grp' }, h('label', { class: 'k', for: 'pname' }, 'Nombre'), name));
  body.append(h('div', { class: 'grp' }, h('span', { class: 'k' }, 'Avatar'),
    h('div', { class: 'avpick' }, Z.AVATARS.map(ic => h('button', { type: 'button', 'aria-label': 'Avatar ' + ic, 'aria-pressed': String(P.avatar.ico === ic), onclick: () => { Z.profile.set({ avatar: { ico: ic } }); Z.profile.unlock('avatar'); renderTab('editar'); } }, Z.icon(ic))))));
  body.append(h('div', { class: 'grp' }, h('span', { class: 'k' }, 'Color del avatar'),
    h('div', { class: 'cdots' }, Object.keys(AV_COLS).map(c => h('button', { type: 'button', 'aria-label': 'Color ' + c, style: 'background:' + AV_COLS[c], 'aria-pressed': String(P.avatar.col === c), onclick: () => { Z.profile.set({ avatar: { col: c } }); renderTab('editar'); } })))));
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const ok = Z.profile.import(await f.text());
    Z.toast({ kind: ok ? 'rec' : 'lvl', title: ok ? 'Perfil importado' : 'No se pudo importar', text: ok ? 'Tus datos se han cargado.' : 'El archivo no es un perfil válido.', icon: ok ? 'trophy' : 'lock' });
    if (ok) { applyCfg(); renderTab('editar'); }
  } });
  let sure = false; const rst = h('button', { class: 'btn sm danger', type: 'button', onclick: () => {
    if (!sure) { sure = true; rst.textContent = '¿Seguro? Pulsa otra vez'; setTimeout(() => { sure = false; rst.textContent = 'Reiniciar progreso'; }, 3500); return; }
    Z.profile.reset(); applyCfg(); renderTab('editar'); Z.toast({ kind: 'lvl', title: 'Progreso reiniciado', text: 'Vuelves a empezar desde cero.', icon: 'skull' });
  } }, 'Reiniciar progreso');
  body.append(h('div', { class: 'grp' }, h('span', { class: 'k' }, 'Datos'), h('div', { class: 'row' },
    h('button', { class: 'btn sm', type: 'button', onclick: () => {
      const blob = new Blob([Z.profile.export()], { type: 'application/json' }), a = h('a', { href: URL.createObjectURL(blob), download: 'zap-arcade-perfil.json' });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } }, 'Exportar'),
    h('button', { class: 'btn sm', type: 'button', onclick: () => file.click() }, 'Importar'), rst, file),
    h('p', { class: 'hint' }, 'Todo se guarda solo en este navegador. Exporta tu perfil para llevártelo a otro dispositivo.')));
}
$('#profBtn').addEventListener('click', () => openProfile());

/* =====================================================================
   Arranque
   ===================================================================== */
buildHub();
applyCfg();
if (!store.get('welcomed', false)) {
  store.set('welcomed', true);
  setTimeout(() => Z.toast({ kind: 'lvl', title: 'Bienvenido a ZAP Arcade', text: 'Juega para subir de nivel y desbloquear temas nuevos.', icon: 'star', ms: 6000 }), 900);
}
route();
Z.start();
window.ZAP_READY = true;
})();
