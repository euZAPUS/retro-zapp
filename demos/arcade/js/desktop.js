/* © 2026 euZAPUS · Todos los derechos reservados. Ver LICENSE. */
/* ZAP Arcade · integración con la app de escritorio (Electron).
   Solo actúa si existe window.zapDesktop (lo inyecta preload.js); en la web normal no hace nada. */
(() => {
'use strict';
const D = window.zapDesktop, Z = window.ZAP;
if (!D || !Z) return;
document.documentElement.dataset.app = 'desktop';

const panel = document.getElementById('settings'), cfgBtn = document.getElementById('cfgBtn');
const foot = document.querySelector('footer a'); if (foot) foot.remove();

const msg = document.createElement('span'); msg.className = 'updmsg';
const bar = document.createElement('i'); const track = document.createElement('div'); track.className = 'updbar'; track.append(bar);
const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn sm';
const ver = document.createElement('span'); ver.className = 'k';
const grp = document.createElement('div'); grp.className = 'grp';
const k = document.createElement('span'); k.className = 'k'; k.textContent = 'Aplicación de escritorio';
grp.append(k, ver, msg, track, btn);
panel.prepend(grp);

let announced = null;
function render(s) {
  ver.textContent = 'Versión instalada: ' + s.version;
  track.hidden = s.status !== 'downloading' && s.status !== 'installing';
  bar.style.width = (s.status === 'installing' ? 100 : s.progress || 0) + '%';
  btn.disabled = false; btn.classList.remove('on');
  switch (s.status) {
    case 'checking': msg.textContent = 'Buscando actualizaciones…'; btn.textContent = 'Buscando…'; btn.disabled = true; break;
    case 'uptodate': msg.textContent = 'Estás al día.'; btn.textContent = 'Buscar actualizaciones'; break;
    case 'available': msg.textContent = 'Hay una versión nueva: ' + s.available; btn.textContent = 'Actualizar y reiniciar'; btn.classList.add('on'); break;
    case 'downloading': msg.textContent = 'Descargando… ' + (s.progress || 0) + ' %'; btn.textContent = 'Descargando…'; btn.disabled = true; break;
    case 'installing': msg.textContent = 'Instalando. La app se reiniciará sola…'; btn.textContent = 'Reiniciando…'; btn.disabled = true; break;
    case 'error': msg.textContent = 'No se pudo actualizar: ' + (s.error || 'error desconocido'); btn.textContent = 'Reintentar'; break;
    case 'dev': msg.textContent = 'Modo desarrollo: las actualizaciones automáticas solo funcionan en la app instalada.'; btn.textContent = 'No disponible'; btn.disabled = true; break;
    default: msg.textContent = 'Pulsa para comprobar si hay una versión nueva.'; btn.textContent = 'Buscar actualizaciones';
  }
  if (s.status === 'available') {
    cfgBtn.dataset.update = '1';
    if (announced !== s.available) {
      announced = s.available;
      Z.toast({ kind: 'lvl', title: 'Actualización disponible', text: 'Versión ' + s.available + ': ábrela desde Ajustes → Actualizar.', icon: 'bolt', ms: 7000 });
    }
  } else delete cfgBtn.dataset.update;
}
btn.addEventListener('click', () => { D.runUpdate(); });
D.onState(render);
D.getState().then(render);
})();
