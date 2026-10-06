/* Copia el arcade web (../demos/arcade) a ./app para empaquetarlo dentro de la app de escritorio. */
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', '..', 'demos', 'arcade');
const dst = path.join(__dirname, '..', 'app');
if (!fs.existsSync(path.join(src, 'index.html'))) { console.error('No encuentro ' + src); process.exit(1); }
fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(src, dst, { recursive: true });
console.log('Arcade copiado a ' + dst);
