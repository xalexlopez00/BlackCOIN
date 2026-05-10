/**
 * BlackCOIN Block Watcher
 * Vigila la red y notifica cuando recibes monedas.
 * Soporta alerts de sonido y notificaciones desktop.
 *
 * Uso:
 *   node blockWatcher.js <direccion|name.pro> [api_url]
 *
 * Ejemplo:
 *   node blockWatcher.js Pc60444a8c827f9d56b416b912909ad1516a2b457
 *   node blockWatcher.js Pc60444a8c827f9d56b416b912909ad1516a2b457 http://localhost:3001
 *   node blockWatcher.js alice.pro
 */

const axios = require('axios');

let WATCH_ADDRESS = process.argv[2];
const API_URL = process.argv[3] || 'http://localhost:3001';

if (!WATCH_ADDRESS) {
  console.log('');
  console.log('  Uso: node blockWatcher.js <direccion|name.pro> [api_url]');
  console.log('  Ejemplo: node blockWatcher.js Pc60444a8c827f9d56b416b912909ad1516a2b457');
  console.log('  Ejemplo: node blockWatcher.js alice.pro');
  console.log('');
  process.exit(1);
}

// Resolve CNS name if needed
if (WATCH_ADDRESS.endsWith('.pro')) {
  const name = WATCH_ADDRESS;
  axios.get(`${API_URL}/api/v1/names/resolve/${name}`)
    .then(r => {
      WATCH_ADDRESS = r.data.address;
      console.log(`  Resolved ${name} -> ${WATCH_ADDRESS}`);
      start();
    })
    .catch(() => {
      console.log(`  Error: Name '${name}' not found on ${API_URL}`);
      process.exit(1);
    });
} else {
  start();
}

function beep() {
  // Windows: bell character, Linux/Mac: console bell
  process.stdout.write('\x07');
  // Also try to use system beep
  try {
    if (process.platform === 'win32') {
      require('child_process').exec('powershell -c "[console]::beep(880,200)"');
    }
  } catch {}
}

function notify(title, message) {
  beep();
  try {
    // Windows notification
    if (process.platform === 'win32') {
      const s = require('child_process').spawn('powershell', [
        '-c',
        `[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); ` +
        `$n = New-Object System.Windows.Forms.NotifyIcon; ` +
        `$n.Icon = [System.Drawing.SystemIcons]::Information; ` +
        `$n.BalloonTipIcon = 'Info'; ` +
        `$n.BalloonTipTitle = '${title.replace(/'/g, "''")}'; ` +
        `$n.BalloonTipText = '${message.replace(/'/g, "''")}'; ` +
        `$n.Visible = $true; ` +
        `$n.ShowBalloonTip(5000); ` +
        `Start-Sleep 5; ` +
        `$n.Dispose()`
      ]);
      s.unref();
    }
  } catch {}
}

let lastBlockIndex = -1;
let seenTxes = new Set();

async function checkNode() {
  try {
    const info = (await axios.get(`${API_URL}/api/v1/info`)).data;
    return info.latestBlock;
  } catch {
    return null;
  }
}

async function checkBlock(index) {
  try {
    const block = (await axios.get(`${API_URL}/api/v1/blocks/index/${index}`)).data;
    return block;
  } catch {
    return null;
  }
}

async function watch() {
  const latest = await checkNode();
  if (latest === null) {
    console.log(`  [${new Date().toLocaleTimeString()}] Conectando a ${API_URL}...`);
    return;
  }

  if (lastBlockIndex === -1) {
    lastBlockIndex = latest;
    console.log(`  [${new Date().toLocaleTimeString()}] Vigilando desde bloque #${latest}`);
    console.log(`  [${new Date().toLocaleTimeString()}] Direccion vigilada: ${WATCH_ADDRESS}`);
    console.log('');
    return;
  }

  while (lastBlockIndex < latest) {
    lastBlockIndex++;
    const block = await checkBlock(lastBlockIndex);
    if (!block) break;

    const txs = block.data || [];
    for (const tx of txs) {
      if (seenTxes.has(tx.id)) continue;
      seenTxes.add(tx.id);

      const outputs = tx.txOuts || [];
      for (const out of outputs) {
        if (out.address === WATCH_ADDRESS) {
          const time = new Date().toLocaleString();
          console.log('');
          console.log('  =======================================');
          console.log(`  ${new Date().toLocaleTimeString()} [!!] TRANSACCION ENTRANTE`);
          console.log('  =======================================');
          console.log(`  Bloque   : #${block.index}`);
          console.log(`  TxID     : ${tx.id}`);
          console.log(`  Cantidad : ${out.amount} PRO`);
          console.log(`  Bloque   : ${block.hash.substring(0, 20)}...`);
          console.log('');
           notify('BlackCOIN', `Recibiste ${out.amount} PRO en bloque #${block.index}`);
        }
      }
    }
  }
}

function start() {
  console.log('');
  console.log('  BlackCOIN Block Watcher');
  console.log('  ' + '='.repeat(40));
  console.log(`  Direccion: ${WATCH_ADDRESS}`);
  console.log(`  API      : ${API_URL}`);
  console.log(`  Sonido   : Activado`);
  console.log(`  Desktop  : ${process.platform === 'win32' ? 'Windows Toast' : 'Solo consola'}`);
  console.log('');

  setInterval(watch, 3000);
  watch();
}
