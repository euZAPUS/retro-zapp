/* Renderiza el anuncio frame a frame (1920x1080, 30 fps) llamando a window.seek(t) de promo.html.
   Uso: OUT=/ruta node render.js            -> todos los frames en $OUT/render
        OUT=/ruta node render.js 5.0 12.5   -> solo esos instantes en $OUT/debug (para revisar) */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const OUT = process.env.OUT || path.join(__dirname, 'out'), FPS = 30, TOTAL = 30 * FPS, WORKERS = +(process.env.WORKERS || 3);
const MIME = { '.html': 'text/html', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = u === '/promo.html' ? path.join(__dirname, 'promo.html') : path.join(OUT, path.normalize(u).replace(/^(\.\.[/\\])+/, ''));
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
});
(async () => {
  await new Promise(r => server.listen(8770, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const times = process.argv.slice(2).map(Number).filter(n => !isNaN(n));
  const debug = times.length > 0, dir = path.join(OUT, debug ? 'debug' : 'render'); fs.mkdirSync(dir, { recursive: true });
  const jobs = debug ? times.map(t => ({ t, file: 'd' + String(t).replace('.', '_') + '.jpg' })) : Array.from({ length: TOTAL }, (_, f) => ({ t: f / FPS, file: 'f' + String(f + 1).padStart(4, '0') + '.jpg' }));
  let next = 0, done = 0; const t0 = Date.now();
  async function worker() {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage(); page.on('pageerror', e => console.log('PAGEERR', String(e)));
    await page.goto('http://localhost:8770/promo.html'); await page.evaluate('window.promoReady');
    while (next < jobs.length) {
      const j = jobs[next++];
      await page.evaluate(t => window.seek(t), j.t);
      await page.screenshot({ path: path.join(dir, j.file), type: 'jpeg', quality: 93 });
      if (++done % 60 === 0) console.log(done + '/' + jobs.length, Math.round((Date.now() - t0) / 1000) + 's');
    }
    await ctx.close();
  }
  await Promise.all(Array.from({ length: debug ? 1 : WORKERS }, worker));
  await browser.close(); server.close(); console.log('listo', jobs.length, 'frames en', Math.round((Date.now() - t0) / 1000) + 's');
})().catch(e => { console.error(e); process.exit(1); });
