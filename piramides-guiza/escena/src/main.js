// Motor de la pieza: inicializa el mundo, las escenas y expone renderCuadro(f) para el
// render determinista cuadro a cuadro (cada cuadro depende solo de su tiempo t = f / fps).
import * as THREE from 'three';
import { Mundo } from './mundo.js';
import { Post } from './post.js';
import { Multitud } from './trabajadores.js';
import { cargarFuentes, subtitulos, portada } from './texto.js';
import { ESCENAS, TRANSICIONES } from './escenas/index.js';
import { clamp } from './util.js';

const params = new URLSearchParams(location.search);
const ANCHO = Number(params.get('w') || 1080), ALTO = Number(params.get('h') || 1920);
const MUESTRAS = Number(params.get('msaa') ?? 4);
const FPS = 30;

const glCanvas = document.getElementById('gl');
glCanvas.width = ANCHO; glCanvas.height = ALTO;
const final = document.getElementById('final');
final.width = ANCHO; final.height = ALTO;
const g2 = final.getContext('2d');
const capa = document.createElement('canvas'); capa.width = ANCHO; capa.height = ALTO;
const gCapa = capa.getContext('2d');

const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(ANCHO, ALTO, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;
renderer.autoClear = true;

const ctx = { THREE, renderer, ANCHO, ALTO, FPS };

async function preparar() {
  const [tl] = await Promise.all([fetch('/escena/timeline.json').then((r) => r.json()), cargarFuentes()]);
  ctx.tl = tl;
  ctx.mundo = new Mundo(renderer);
  ctx.camara = new THREE.PerspectiveCamera(50, ANCHO / ALTO, 0.5, 30000);
  ctx.post = new Post(renderer, ANCHO, ALTO, MUESTRAS);
  ctx.multitud = new Multitud(Number(params.get('trabajadores') || 700));
  ctx.mundo.escena.add(ctx.multitud.grupo);
  for (const e of ESCENAS) await e.preparar(ctx);
  for (const e of ESCENAS) e.desactivar(ctx);
  // compilar shaders de antemano
  renderer.compile(ctx.mundo.escena, ctx.camara);
  window.__listo = true;
  return { escenas: ESCENAS.map((e) => [e.id, e.inicio, e.fin]), duracion: tl.duracion };
}

let activa = null;
function usarEscena(e) {
  if (activa === e) return;
  if (activa) activa.desactivar(ctx);
  ctx.multitud.ocultarTodos();
  e.activar(ctx);
  activa = e;
}

function escenaEn(t) {
  for (const e of ESCENAS) if (t >= e.inicio && t < e.fin) return e;
  return ESCENAS[ESCENAS.length - 1];
}

// Renderiza la escena e en el tiempo t y deja el resultado en el canvas WebGL
function renderEscena(e, t) {
  usarEscena(e);
  ctx.multitud.ocultarTodos();
  const o = e.actualizar(ctx, t, t - e.inicio) || {};
  ctx.multitud.actualizar(t);
  ctx.mundo.seguir(ctx.camara);
  ctx.post.render(ctx.mundo.escena, ctx.camara, { tiempo: t, solMundo: ctx.camara.position.clone().addScaledVector(ctx.mundo.solDir, 5000), ...o });
  return o;
}

function renderCuadro(f) {
  const t = f / FPS;
  const e = escenaEn(t);
  // ¿transición con fundido entre escenas?
  const tr = TRANSICIONES.find((x) => Math.abs(t - x.t) < x.dur / 2 && x.tipo === 'fundido');
  g2.globalAlpha = 1;
  if (tr) {
    const a = ESCENAS.find((s) => s.fin === tr.t), b = ESCENAS.find((s) => s.inicio === tr.t);
    const mezcla = clamp((t - (tr.t - tr.dur / 2)) / tr.dur);
    renderEscena(a, Math.min(t, a.fin - 1e-4));
    g2.drawImage(glCanvas, 0, 0);
    renderEscena(b, Math.max(t, b.inicio));
    g2.globalAlpha = mezcla * mezcla * (3 - 2 * mezcla);
    g2.drawImage(glCanvas, 0, 0);
    g2.globalAlpha = 1;
  } else {
    renderEscena(e, t);
    g2.drawImage(glCanvas, 0, 0);
  }
  // capa de textos de la(s) escena(s)
  gCapa.clearRect(0, 0, ANCHO, ALTO);
  for (const s of ESCENAS) if (s.overlay && t >= s.inicio - 0.6 && t < s.fin + 0.6) s.overlay(gCapa, t, t - s.inicio, ctx);
  if (params.get('subs') !== '0') subtitulos(gCapa, t, ctx.tl);
  g2.drawImage(capa, 0, 0);
  return final;
}

// Portada vertical: cuadro del video con el título principal y sin subtítulos
function renderPortada(t) {
  const e = escenaEn(t);
  renderEscena(e, t);
  g2.globalAlpha = 1;
  g2.drawImage(glCanvas, 0, 0);
  portada(g2, ANCHO, ALTO);
  return final.toDataURL('image/png');
}

window.preparar = preparar;
window.renderPortada = renderPortada;
window.renderCuadro = (f, calidad = 0.93) => renderCuadro(f).toDataURL('image/jpeg', calidad);
window.renderCuadroPNG = (f) => renderCuadro(f).toDataURL('image/png');
window.ctx = ctx;

if (params.get('auto') === '1') {
  preparar().then(() => {
    const t0 = Number(params.get('t') || 0);
    let f = Math.round(t0 * FPS);
    const bucle = () => { renderCuadro(f++); if (f < ctx.tl.duracion * FPS) requestAnimationFrame(bucle); };
    bucle();
  });
}
