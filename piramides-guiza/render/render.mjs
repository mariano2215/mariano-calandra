// Render determinista cuadro a cuadro con Chromium sin interfaz (WebGL por SwiftShader).
// Uso:
//   node render/render.mjs --tiempos 0.5,13.2,44 --salida /ruta/previas   (cuadros sueltos, PNG)
//   node render/render.mjs --desde 0 --hasta 2100 --procesos 3 --salida /ruta/cuadros   (secuencia JPEG)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { iniciarServidor } from './servidor.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : '1']);
  return acc;
}, []));
const FPS = 30;
const salida = path.resolve(args.salida || 'salida/cuadros');
fs.mkdirSync(salida, { recursive: true });
const ancho = Number(args.w || 1080), alto = Number(args.h || 1920);
const extra = args.query ? `&${args.query}` : '';

async function abrir(puerto) {
  const navegador = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--disable-gpu-watchdog', '--js-flags=--max-old-space-size=4096'] });
  const pagina = await navegador.newPage({ viewport: { width: 540, height: 960 } });
  pagina.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log(`[navegador ${m.type()}]`, m.text().slice(0, 400)); });
  pagina.on('pageerror', (e) => console.log('[error de página]', e.message));
  await pagina.goto(`http://127.0.0.1:${puerto}/escena/index.html?w=${ancho}&h=${alto}${extra}`);
  await pagina.waitForFunction(() => typeof window.preparar === 'function', null, { timeout: 120000 });
  const info = await pagina.evaluate(() => window.preparar());
  return { navegador, pagina, info };
}

function guardar(dataURL, archivo) {
  fs.writeFileSync(archivo, Buffer.from(dataURL.split(',')[1], 'base64'));
}

async function principal() {
  const { srv, puerto } = await iniciarServidor(0);
  if (args.portada) {
    const { navegador, pagina } = await abrir(puerto);
    for (const ts of args.portada.split(',')) {
      const d = await pagina.evaluate((t) => window.renderPortada(t), Number(ts));
      const nombre = path.join(salida, `portada_t${ts}.png`);
      guardar(d, nombre);
      console.log('portada →', nombre);
    }
    await navegador.close(); srv.close(); return;
  }
  if (args.tiempos) {
    const { navegador, pagina } = await abrir(puerto);
    for (const ts of args.tiempos.split(',')) {
      const f = Math.round(Number(ts) * FPS);
      const t0 = Date.now();
      const d = await pagina.evaluate((f) => window.renderCuadroPNG(f), f);
      const nombre = path.join(salida, `t${Number(ts).toFixed(2).padStart(6, '0')}.png`);
      guardar(d, nombre);
      console.log(`cuadro ${f} (t=${ts}s) en ${((Date.now() - t0) / 1000).toFixed(2)}s → ${nombre}`);
    }
    await navegador.close(); srv.close(); return;
  }
  const desde = Number(args.desde || 0), hasta = Number(args.hasta || 2100);
  const procesos = Number(args.procesos || 1);
  const pendientes = [];
  for (let f = desde; f < hasta; f++) {
    const arch = path.join(salida, `c${String(f).padStart(5, '0')}.jpg`);
    if (!fs.existsSync(arch) || args.rehacer) pendientes.push(f);
  }
  console.log(`Cuadros pendientes: ${pendientes.length} con ${procesos} proceso(s)`);
  const t0 = Date.now();
  let hechos = 0;
  // reparto en bloques contiguos (coherencia de caché de geometría por escena)
  const bloques = Array.from({ length: procesos }, (_, i) => pendientes.slice(Math.floor(i * pendientes.length / procesos), Math.floor((i + 1) * pendientes.length / procesos)));
  await Promise.all(bloques.map(async (lista, i) => {
    if (!lista.length) return;
    const { navegador, pagina } = await abrir(puerto);
    for (const f of lista) {
      const d = await pagina.evaluate((f) => window.renderCuadro(f, 0.94), f);
      guardar(d, path.join(salida, `c${String(f).padStart(5, '0')}.jpg`));
      hechos++;
      if (hechos % 20 === 0) {
        const s = (Date.now() - t0) / 1000;
        console.log(`[${i}] ${hechos}/${pendientes.length} — ${(s / hechos).toFixed(2)} s/cuadro efectivo, restan ~${((pendientes.length - hechos) * s / hechos / 60).toFixed(1)} min`);
      }
    }
    await navegador.close();
  }));
  console.log(`Listo en ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  srv.close();
}

principal().catch((e) => { console.error(e); process.exit(1); });
