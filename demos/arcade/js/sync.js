/* © 2026 euZAPUS · Todos los derechos reservados. Ver LICENSE. */
/* ZAP Arcade · sincronización del perfil entre equipos.
   Guarda el perfil (récords, logros, nivel, ajustes de aspecto) en un Gist SECRETO de tu cuenta de GitHub y lo fusiona
   entre equipos con un token personal (clásico, solo permiso "gist"). La fusión es a tres bandas: lo jugado en cada equipo
   se SUMA (nunca se pisa) y los récords se quedan con el mejor. */
(() => {
'use strict';
const Z = window.ZAP, store = Z.store;
const APP = window.zapDesktop;
const FILE = 'zap-arcade-profile.json', DESC = 'ZAP Arcade · perfil sincronizado';
const API = store.get('sync-api', 'https://api.github.com');        // se puede cambiar solo para pruebas
const S = Object.assign({ gist: '', login: '', last: 0, auto: true, base: null, device: '' }, store.get('sync', {}));
if (!S.device) S.device = Math.random().toString(36).slice(2, 10);
const saveS = () => store.set('sync', S);
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------- almacén del token: cifrado por el sistema en la app de escritorio ---------- */
const secret = {
  async get() { try { if (APP && APP.secret) { const v = await APP.secret.get(); if (v) return v; } } catch (e) { /* nada */ } return store.get('sync-token', ''); },
  async set(v) { let ok = false; try { ok = !!(APP && APP.secret && await APP.secret.set(v)); } catch (e) { ok = false; } if (ok) store.del('sync-token'); else store.set('sync-token', v); return ok; },
  async del() { try { if (APP && APP.secret) await APP.secret.del(); } catch (e) { /* nada */ } store.del('sync-token'); }
};

/* ---------- fusión a tres bandas ---------- */
const num = x => (typeof x === 'number' && isFinite(x) ? x : 0);
const add = (r, l, b) => num(r) + Math.max(0, num(l) - num(b));       // remoto + lo nuevo de este equipo desde la última sincronización
const better = (a, b, low) => (a == null ? (b == null ? null : b) : b == null ? a : low ? Math.min(a, b) : Math.max(a, b));
const keys = (...os) => Array.from(new Set(os.flatMap(o => Object.keys(o || {}))));

function mergeProfile(R, L, B) {
  if (!R) return clone(L);
  B = B || {};
  const M = clone(R);
  M.xp = add(R.xp, L.xp, B.xp); M.time = add(R.time, L.time, B.time); M.plays = add(R.plays, L.plays, B.plays); M.records = add(R.records, L.records, B.records);
  M.created = Math.min(num(R.created) || Infinity, num(L.created) || Infinity); if (!isFinite(M.created)) M.created = Date.now();
  if (num(L.edited) > num(R.edited)) { M.name = L.name; M.avatar = clone(L.avatar || R.avatar); M.edited = L.edited; }
  M.visits = {}; keys(R.visits, L.visits).forEach(g => { M.visits[g] = add((R.visits || {})[g], (L.visits || {})[g], (B.visits || {})[g]); });
  M.days = Array.from(new Set([...(R.days || []), ...(L.days || [])])).sort().slice(-90);
  M.ach = Object.assign({}, R.ach); keys(L.ach).forEach(id => { const a = L.ach[id], r = M.ach[id]; M.ach[id] = r == null ? a : Math.min(r, a); });
  M.games = {};
  keys(R.games, L.games).forEach(g => {
    const rg = (R.games || {})[g] || {}, lg = (L.games || {})[g] || {}, bg = ((B.games || {})[g]) || {};
    const mg = M.games[g] = { plays: add(rg.plays, lg.plays, bg.plays), time: add(rg.time, lg.time, bg.time), last: Math.max(num(rg.last), num(lg.last)), modes: {} };
    keys(rg.modes, lg.modes).forEach(mid => {
      const rm = (rg.modes || {})[mid] || {}, lm = (lg.modes || {})[mid] || {}, bm = ((bg.modes || {})[mid]) || {};
      const low = Z.metricOf(g, mid).better === 'low';
      const dPlays = Math.max(0, num(lm.plays) - num(bm.plays)), lh = lm.hist || [];
      const fresh = dPlays ? lh.slice(Math.max(0, lh.length - dPlays)) : [];
      mg.modes[mid] = { plays: add(rm.plays, lm.plays, bm.plays), best: better(rm.best == null ? null : rm.best, lm.best == null ? null : lm.best, low), hist: [...(rm.hist || []), ...fresh].slice(-30) };
    });
  });
  return M;
}

/* ---------- aspecto (tema, fondo, marco, estilos): gana el último que cambió algo ---------- */
const APP_KEYS = ['skin', 'accent', 'glass', 'bg', 'crt', 'frame', 'fx', 'shake'];
function readAppearance() {
  const cfg = {}; APP_KEYS.forEach(k => { cfg[k] = Z.cfg[k]; });
  const skins = {}; Z.order.forEach(g => { if (Z.games[g].skins) { const v = store.get('skin:' + g, null); if (v) skins[g] = v; } });
  return { at: store.get('cfg-at', 0), cfg, skins };
}
function applyAppearance(a) {
  if (!a || !a.cfg) return false;
  const cur = readAppearance(); if (JSON.stringify(cur.cfg) === JSON.stringify(a.cfg) && JSON.stringify(cur.skins) === JSON.stringify(a.skins || {})) { store.set('cfg-at', a.at); return false; }
  APP_KEYS.forEach(k => { if (a.cfg[k] !== undefined) Z.cfg[k] = a.cfg[k]; });
  Object.keys(a.skins || {}).forEach(g => store.set('skin:' + g, a.skins[g]));
  store.set('cfg-at', a.at); Z.emit('cfg-sync'); return true;
}
const mergeAppearance = (R, L) => (R && R.at > L.at ? R : L);

/* ---------- API de GitHub ---------- */
async function gh(path, opt, token) {
  let r;
  try { r = await fetch(API + path, Object.assign({}, opt, { headers: Object.assign({ Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token }, opt && opt.body ? { 'Content-Type': 'application/json' } : {}) })); }
  catch (e) { const er = new Error('Sin conexión con GitHub'); er.status = 0; throw er; }
  if (!r.ok) {
    const er = new Error(r.status === 401 ? 'Token no válido o caducado' : r.status === 403 || r.status === 429 ? 'GitHub ha limitado las peticiones; prueba en unos minutos' : r.status === 404 ? 'No se encuentra el Gist' : 'Error de GitHub (' + r.status + ')');
    er.status = r.status; throw er;
  }
  return r.status === 204 ? null : r.json();
}
async function findGist(token) {
  for (let page = 1; page <= 5; page++) {
    const list = await gh('/gists?per_page=100&page=' + page, {}, token);
    const g = list.find(x => x.files && x.files[FILE]); if (g) return g.id;
    if (list.length < 100) break;
  }
  return '';
}

/* ---------- sincronizar ---------- */
let busy = false, applying = false, timer = 0, ui = null;
const connected = () => !!(S.login && S.hasToken);
async function syncNow(why) {
  if (busy) return { skipped: true };
  busy = true; ui && ui.render('Sincronizando…');
  try {
    const token = await secret.get(); if (!token) { S.hasToken = false; throw new Error('Falta el token'); }
    if (!S.gist) S.gist = await findGist(token);
    const local = { profile: Z.profile.snapshot(), appearance: readAppearance() };
    let R = null;
    if (S.gist) {
      try { const g = await gh('/gists/' + S.gist, {}, token), f = g.files && g.files[FILE]; R = f ? JSON.parse(f.content) : null; }
      catch (e) { if (e.status === 404) { S.gist = ''; R = null; } else throw e; }
    }
    if (R && !R.profile) R = null;
    const merged = R ? mergeProfile(R.profile, local.profile, S.base) : local.profile;
    const mergedApp = mergeAppearance(R && R.appearance, local.appearance);
    const payload = { app: 'zap-arcade-sync', v: 1, updated: Date.now(), device: S.device, profile: merged, appearance: mergedApp };
    const changedRemote = !R || JSON.stringify(R.profile) !== JSON.stringify(merged) || JSON.stringify(R.appearance || {}) !== JSON.stringify(mergedApp);
    if (changedRemote) {
      const body = JSON.stringify({ description: DESC, files: { [FILE]: { content: JSON.stringify(payload) } } });
      if (S.gist) await gh('/gists/' + S.gist, { method: 'PATCH', body }, token);
      else { const g = await gh('/gists', { method: 'POST', body: JSON.stringify({ description: DESC, public: false, files: { [FILE]: { content: JSON.stringify(payload) } } }) }, token); S.gist = g.id; }
    }
    /* si se jugó mientras sincronizábamos, se conserva lo nuevo: final = fusionado + (ahora - antes) */
    const now = Z.profile.snapshot();
    const final = JSON.stringify(now) === JSON.stringify(local.profile) ? merged : mergeProfile(merged, now, local.profile);
    const pulled = R ? Math.max(0, num(merged.plays) - num(local.profile.plays)) : 0;
    if (JSON.stringify(now) !== JSON.stringify(final)) { applying = true; try { Z.profile.replace(final); } finally { applying = false; } }
    applyAppearance(mergedApp);
    S.base = clone(merged); S.last = Date.now(); S.error = ''; saveS();
    if (pulled > 0) Z.toast({ kind: 'rec', title: 'Perfil sincronizado', text: '+' + pulled + (pulled === 1 ? ' partida' : ' partidas') + ' de tus otros equipos', icon: 'trophy' });
    return { ok: true, pulled, created: !R };
  } catch (e) {
    S.error = e.message || 'Error'; if (e.status === 401) S.hasToken = false; saveS();
    return { ok: false, error: S.error };
  } finally { busy = false; ui && ui.render(); }
}

/* ---------- conectar / desconectar ---------- */
async function connect(token) {
  token = String(token || '').trim();
  if (!/^[A-Za-z0-9_\-]{20,255}$/.test(token)) return { ok: false, error: 'Ese token no tiene buena pinta: cópialo entero (empieza por ghp_ o github_pat_)' };
  try {
    const u = await gh('/user', {}, token);
    S.login = u.login; S.hasToken = true; S.gist = ''; S.base = null; S.error = '';
    const stored = await secret.set(token); S.secure = stored; saveS();
  } catch (e) { return { ok: false, error: e.message }; }
  const r = await syncNow('conectar');
  if (r.ok) Z.toast({ kind: 'lvl', title: 'Sincronización activada', text: r.created ? 'Se ha creado tu Gist secreto con este perfil.' : 'Se ha combinado con el perfil guardado en GitHub.', icon: 'star' });
  return r;
}
async function disconnect() {
  await secret.del(); S.login = ''; S.hasToken = false; S.base = null; S.gist = ''; S.last = 0; S.error = ''; saveS(); ui && ui.render();
}

/* ---------- disparadores automáticos ---------- */
function schedule() { if (applying || !connected() || !S.auto) return; clearTimeout(timer); timer = setTimeout(() => syncNow('auto'), 10000); }
Z.on('profile', schedule); Z.on('cfg-changed', schedule);
Z.sync = { syncNow, merge: mergeProfile, connect, disconnect, state: () => Object.assign({}, S, { base: undefined }), readAppearance };

/* ---------- panel en Ajustes ---------- */
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) for (const k in props) { const v = props[k]; if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); }
  kids.flat().forEach(c => { if (c == null || c === false) return; e.append(c.nodeType ? c : document.createTextNode(String(c))); });
  return e;
}
const ago = ms => { const s = Math.round((Date.now() - ms) / 1000); if (s < 10) return 'ahora mismo'; if (s < 90) return 'hace ' + s + ' s'; if (s < 5400) return 'hace ' + Math.round(s / 60) + ' min'; if (s < 129600) return 'hace ' + Math.round(s / 3600) + ' h'; return 'hace ' + Math.round(s / 86400) + ' d'; };
const panel = document.getElementById('settings');
if (panel) {
  const grp = h('div', { class: 'grp', id: 'syncgrp' });
  panel.insertBefore(grp, panel.firstChild);
  ui = {
    render(busyMsg) {
      grp.innerHTML = '';
      grp.append(h('span', { class: 'k' }, 'Sincronización entre equipos'));
      if (!connected()) {
        const input = h('input', { type: 'password', id: 'synctoken', placeholder: 'Pega aquí tu token (ghp_…)', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Token de GitHub' });
        const msg = h('span', { class: 'updmsg', id: 'syncmsg' }, S.error || '');
        const btn = h('button', { class: 'btn sm on', type: 'button', onclick: async () => { btn.disabled = true; msg.textContent = 'Conectando…'; const r = await connect(input.value); if (!r.ok) { msg.textContent = r.error; btn.disabled = false; } input.value = ''; } }, 'Conectar con GitHub');
        grp.append(
          h('span', { class: 'updmsg' }, 'Guarda tu perfil y récords en un Gist secreto de tu cuenta y los comparte entre tus PCs.'),
          h('span', { class: 'updmsg' }, '1. ', h('a', { href: 'https://github.com/settings/tokens/new?scopes=gist&description=ZAP%20Arcade%20sync', target: '_blank', rel: 'noopener', style: 'color:var(--cyan)' }, 'Crea un token'), ' con SOLO el permiso «gist». 2. Pégalo y conecta. 3. Repite en el otro PC con el mismo token.'),
          input, btn, msg);
      } else {
        grp.append(
          h('span', { class: 'updmsg' }, 'Conectado como @' + S.login + (S.last ? ' · última sincronización ' + ago(S.last) : '')),
          busyMsg ? h('span', { class: 'updmsg' }, busyMsg) : null,
          S.error ? h('span', { class: 'updmsg', style: 'color:var(--magenta)' }, S.error) : null,
          h('div', { class: 'row' },
            h('button', { class: 'btn sm on', type: 'button', disabled: busy || null, onclick: () => syncNow('manual') }, 'Sincronizar ahora'),
            h('button', { class: 'btn sm danger', type: 'button', onclick: () => disconnect() }, 'Desconectar')),
          h('label', { class: 'opt' }, h('input', { type: 'checkbox', checked: S.auto ? '' : null, onchange: e => { S.auto = e.target.checked; saveS(); } }), h('span', null, 'Automática: al abrir y tras cada partida')),
          h('span', { class: 'updmsg', style: 'color:var(--muted)' }, S.secure ? 'El token se guarda cifrado por Windows.' : 'Aviso: el token se guarda sin cifrar en este equipo.'));
      }
    }
  };
  ui.render();
  setInterval(() => { if (!panel.hidden && connected() && !busy) ui.render(); }, 30000);
}

/* al abrir, y cada 10 minutos mientras esté abierta, trae los cambios de otros equipos */
if (connected() && S.auto) {
  setTimeout(() => syncNow('auto'), 3000);
  setInterval(() => { if (connected() && S.auto && !document.hidden) syncNow('auto'); }, 600000);
}
})();
