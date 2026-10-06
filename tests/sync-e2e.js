/* © 2026 euZAPUS · Todos los derechos reservados. Ver LICENSE. */
/* Prueba de extremo a extremo de la sincronización con un servidor GitHub simulado y dos "PCs".
   Uso: node tests/sync-e2e.js  (con `python3 -m http.server 8765` sirviendo la raíz del repo) */
const http = require('http');
const { chromium } = require('playwright');
const TOKEN = 'ghp_goodtoken1234567890abcdefGHIJ';
const gists = {}; let delayPatch = 0, nextId = 1; const log = [];
const server = http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,content-type,accept', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  let body = ''; req.on('data', d => { body += d; });
  req.on('end', async () => {
    const send = (code, obj) => { res.writeHead(code, Object.assign({ 'Content-Type': 'application/json' }, cors)); res.end(JSON.stringify(obj)); };
    log.push(req.method + ' ' + req.url.split('?')[0]);
    if (req.headers.authorization !== 'Bearer ' + TOKEN) return send(401, { message: 'Bad credentials' });
    const u = req.url.split('?')[0];
    if (u === '/user') return send(200, { login: 'tester' });
    if (u === '/gists' && req.method === 'GET') return send(200, Object.values(gists).map(g => ({ id: g.id, files: Object.fromEntries(Object.keys(g.files).map(k => [k, { filename: k }])) })));
    if (u === '/gists' && req.method === 'POST') { const b = JSON.parse(body), id = 'g' + nextId++; gists[id] = { id, public: b.public, files: Object.fromEntries(Object.entries(b.files).map(([k, v]) => [k, { content: v.content }])) }; return send(201, { id }); }
    const m = u.match(/^\/gists\/(\w+)$/);
    if (m && gists[m[1]]) {
      if (req.method === 'GET') return send(200, gists[m[1]]);
      if (req.method === 'PATCH') { if (delayPatch) await new Promise(r => setTimeout(r, delayPatch)); const b = JSON.parse(body); Object.entries(b.files).forEach(([k, v]) => { gists[m[1]].files[k] = { content: v.content }; }); return send(200, gists[m[1]]); }
    }
    send(404, { message: 'Not Found' });
  });
});
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALLA ') + m); if (!c) fails++; };
(async () => {
  await new Promise(r => server.listen(8790, r));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const URL = 'http://localhost:8765/demos/arcade/';
  async function pc(name) {
    const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
    await ctx.addInitScript(() => { localStorage.setItem('zap-arcade:sync-api', JSON.stringify('http://localhost:8790')); localStorage.setItem('zap-arcade:welcomed', 'true'); localStorage.setItem('zap-arcade:muted', 'true'); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.errs = errs;
    await p.goto(URL); await p.waitForFunction('window.ZAP_READY===true'); p.pcname = name; return p;
  }
  const prof = p => p.evaluate(() => { const d = ZAP.profile.data, g = d.games; return { plays: d.plays, xp: d.xp, rb: g.runner && g.runner.modes.normal && g.runner.modes.normal.best, rp: g.runner && g.runner.modes.normal && g.runner.modes.normal.plays, wb: g.worm && g.worm.modes.classic && g.worm.modes.classic.best, tb: g.tetris && g.tetris.modes.marathon && g.tetris.modes.marathon.best, skin: document.documentElement.dataset.skin }; });
  const sync = p => p.evaluate(() => ZAP.sync.syncNow('manual'));
  const A = await pc('A'), B = await pc('B');
  await A.evaluate(() => { const P = ZAP.profile; P.submitFor('runner', 'normal', 400); P.submitFor('runner', 'normal', 500); P.submitFor('worm', 'classic', 20); });
  await B.evaluate(() => { const P = ZAP.profile; P.submitFor('runner', 'normal', 800); P.submitFor('tetris', 'marathon', 2000); P.submitFor('tetris', 'marathon', 3000); });
  const a0 = await prof(A), b0 = await prof(B); console.log('Antes: A', JSON.stringify(a0), '| B', JSON.stringify(b0));

  console.log('1) Conectar PC A (crea el Gist)');
  await A.click('#cfgBtn'); await A.fill('#synctoken', TOKEN); await A.click('#syncgrp button.on');
  await A.waitForFunction("ZAP.sync.state().last > 0", null, { timeout: 8000 });
  ok(Object.keys(gists).length === 1, 'se creó 1 Gist'); ok(gists.g1.public === false, 'el Gist es secreto (no público)');
  ok((await A.textContent('#syncgrp')).includes('Conectado como @tester'), 'la UI muestra "Conectado como @tester"');

  console.log('2) Conectar PC B (encuentra el Gist y fusiona)');
  await B.click('#cfgBtn'); await B.fill('#synctoken', TOKEN); await B.click('#syncgrp button.on');
  await B.waitForFunction("ZAP.sync.state().last > 0", null, { timeout: 8000 });
  ok(Object.keys(gists).length === 1, 'sigue habiendo 1 solo Gist (no duplica)');
  let b1 = await prof(B);
  ok(b1.plays === a0.plays + b0.plays, 'B suma las partidas de ambos: ' + b1.plays + ' = ' + a0.plays + '+' + b0.plays);
  ok(b1.xp === a0.xp + b0.xp, 'XP sumada: ' + b1.xp);
  ok(b1.rb === 800 && b1.rp === 3 && b1.wb === 20 && b1.tb === 3000, 'récords: runner 800 (3 partidas), worm 20, tetris 3000');

  console.log('3) A recoge lo de B');
  await sync(A); let a1 = await prof(A);
  ok(a1.plays === 6 && a1.rb === 800 && a1.tb === 3000, 'A ahora tiene ' + a1.plays + ' partidas, runner 800, tetris 3000');

  console.log('4) Idempotencia: sincronizar varias veces sin jugar no cambia nada');
  for (let i = 0; i < 3; i++) { await sync(A); await sync(B); }
  const a2 = await prof(A), b2 = await prof(B);
  ok(a2.plays === 6 && b2.plays === 6 && a2.xp === a1.xp && b2.xp === b1.xp, 'siguen en 6 partidas y misma XP (' + a2.xp + ')');

  console.log('5) Jugar en A, sincronizar, B recoge (sin doble conteo)');
  await A.evaluate(() => ZAP.profile.submitFor('runner', 'normal', 900)); await sync(A); await sync(B); await sync(A);
  const a3 = await prof(A), b3 = await prof(B);
  ok(a3.plays === 7 && b3.plays === 7 && b3.rb === 900, 'ambos con 7 partidas y runner 900');

  console.log('6) Jugar MIENTRAS se sincroniza (PATCH lento): no se pierde la partida');
  delayPatch = 700;
  await A.evaluate(() => ZAP.profile.submitFor('worm', 'classic', 5));      // cambio pendiente de subir
  const pend = A.evaluate(() => ZAP.sync.syncNow('manual'));
  await A.waitForTimeout(250); await A.evaluate(() => ZAP.profile.submitFor('tetris', 'marathon', 9000));
  await pend; delayPatch = 0;
  let a4 = await prof(A); ok(a4.plays === 9 && a4.tb === 9000, 'A conserva las 2 partidas nuevas (9 en total, tetris 9000)');
  await sync(A); await sync(B); await sync(A); const a5 = await prof(A), b5 = await prof(B);
  ok(a5.plays === 9 && b5.plays === 9 && b5.tb === 9000, 'tras sincronizar, A y B tienen 9 partidas y tetris 9000 (sin duplicar)');

  console.log('7) Aspecto (tema) se sincroniza');
  await A.click('#cfgBtn').catch(() => {}); await A.evaluate(() => { document.querySelector('.skin[data-skin="sunset"]').click(); });
  await sync(A); await sync(B); const b6 = await prof(B);
  ok(b6.skin === 'sunset', 'B adopta el tema de A: ' + b6.skin);

  console.log('8) Token inválido');
  const C = await pc('C'); await C.click('#cfgBtn'); await C.fill('#synctoken', 'ghp_badbadbadbadbadbadbadbadbadbad99'); await C.click('#syncgrp button.on');
  await C.waitForFunction("document.querySelector('#syncmsg') && document.querySelector('#syncmsg').textContent.includes('Token')", null, { timeout: 8000 });
  ok((await C.textContent('#syncmsg')).includes('no válido'), 'mensaje: ' + (await C.textContent('#syncmsg')));
  await C.fill('#synctoken', 'corto'); await C.click('#syncgrp button.on');
  ok((await C.textContent('#syncmsg')).includes('buena pinta'), 'rechaza un token con formato raro sin llamar a GitHub');

  console.log('9) Desconectar');
  await A.evaluate(() => { document.getElementById('settings').hidden = false; });
  await A.click('#syncgrp button.danger'); await A.waitForTimeout(200);
  ok(!(await A.evaluate(() => !!ZAP.sync.state().login)) && await A.evaluate(() => !!document.getElementById('synctoken')), 'A vuelve al formulario de conexión y olvida el token');
  ok((await A.evaluate(() => localStorage.getItem('zap-arcade:sync-token'))) === null, 'el token no queda guardado');
  const errs = [...A.errs, ...B.errs, ...C.errs]; ok(errs.length === 0, 'sin errores de JS ' + JSON.stringify(errs));
  console.log(fails ? '\nFALLOS: ' + fails : '\nTODO OK'); console.log('Llamadas a la API:', log.length);
  await b.close(); server.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
