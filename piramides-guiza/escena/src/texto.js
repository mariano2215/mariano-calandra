// Capa 2D: subtítulos dinámicos, títulos cinematográficos, etiquetas y gráficos explicativos.
import { clamp, inv, easeOut, easeOutBack, easeInOut } from './util.js';

export const ORO = '#FFC94A';
export const BLANCO = '#FFFFFF';

export async function cargarFuentes() {
  const base = '/node_modules/@fontsource';
  const lista = [
    ['Cinzel', `${base}/cinzel/files/cinzel-latin-700-normal.woff2`, '700'],
    ['Cinzel', `${base}/cinzel/files/cinzel-latin-900-normal.woff2`, '900'],
    ['Montserrat', `${base}/montserrat/files/montserrat-latin-600-normal.woff2`, '600'],
    ['Montserrat', `${base}/montserrat/files/montserrat-latin-700-normal.woff2`, '700'],
    ['Montserrat', `${base}/montserrat/files/montserrat-latin-800-normal.woff2`, '800'],
    ['Montserrat', `${base}/montserrat/files/montserrat-latin-900-normal.woff2`, '900'],
  ];
  for (const [fam, url, peso] of lista) {
    const f = new FontFace(fam, `url(${url})`, { weight: peso });
    await f.load(); document.fonts.add(f);
  }
  await document.fonts.ready;
}

function espaciado(g, px) { try { g.letterSpacing = `${px}px`; } catch (e) { /* navegadores viejos */ } }

// Texto con contorno y sombra suave (alta legibilidad sobre cualquier fondo)
function textoContorno(g, txt, x, y, { color = BLANCO, contorno = 'rgba(0,0,0,0.9)', grosor = 10, sombra = 18 } = {}) {
  g.save();
  g.lineJoin = 'round'; g.miterLimit = 2;
  g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = sombra; g.shadowOffsetY = 4;
  g.strokeStyle = contorno; g.lineWidth = grosor; g.strokeText(txt, x, y);
  g.shadowColor = 'transparent';
  g.fillStyle = color; g.fillText(txt, x, y);
  g.restore();
}

// Subtítulos dinámicos: bloque de 1–3 palabras, palabra activa resaltada y escalada,
// términos clave en dorado, aparición con rebote corto.
export function subtitulos(g, t, tl, { y = 1335, tam = 74 } = {}) {
  const b = tl.bloques.find((c) => t >= c.ini - 0.04 && t < c.fin);
  if (!b) return;
  const W = g.canvas.width;
  const ent = easeOutBack(clamp((t - b.ini + 0.04) / 0.16));
  const sal = clamp((b.fin - t) / 0.08);
  g.save();
  g.font = `900 ${tam}px Montserrat`;
  g.textBaseline = 'alphabetic';
  espaciado(g, 1);
  const palabras = b.palabras.map((i) => tl.palabras[i]);
  const txts = palabras.map((w) => w.palabra.toUpperCase());
  const esp = tam * 0.42;
  const anchos = txts.map((s) => g.measureText(s).width);
  let total = anchos.reduce((a, c) => a + c, 0) + esp * (txts.length - 1);
  const escalaMax = Math.min(1, (W - 120) / total);
  const s0 = (0.82 + 0.18 * ent) * escalaMax;
  g.translate(W / 2, y);
  g.scale(s0, s0);
  g.globalAlpha = clamp(ent * 1.4) * sal;
  // placa translúcida detrás
  g.fillStyle = 'rgba(10,6,2,0.28)';
  const pad = 26;
  redondeado(g, -total / 2 - pad, -tam * 0.95, total + pad * 2, tam * 1.32, 22); g.fill();
  let x = -total / 2;
  palabras.forEach((w, k) => {
    const activa = t >= w.ini - 0.03 && t < w.fin + 0.05;
    const color = w.resaltar ? ORO : BLANCO;
    g.save();
    g.translate(x + anchos[k] / 2, 0);
    const pulso = activa ? 1.05 : 1.0;
    g.scale(pulso, pulso);
    g.textAlign = 'center';
    textoContorno(g, txts[k], 0, 0, { color: activa && !w.resaltar ? '#FFF6E0' : color, grosor: 12 });
    if (activa) {
      g.globalAlpha *= 0.9;
      g.fillStyle = w.resaltar ? ORO : '#FFE7A8';
      g.fillRect(-anchos[k] / 2, tam * 0.16, anchos[k], 7);
    }
    g.restore();
    x += anchos[k] + esp;
  });
  g.restore();
}

export function redondeado(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// Título cinematográfico Cinzel con revelado por tracking + brillo dorado
export function tituloCine(g, lineas, t, ini, fin, { y = 560, tam = 112, color = ORO, fuente = 'Cinzel', peso = 900, sub = null, alinear = 'center' } = {}) {
  if (t < ini || t > fin) return;
  const a = clamp((t - ini) / 0.6), b = clamp((fin - t) / 0.45);
  const W = g.canvas.width;
  g.save();
  g.textAlign = alinear; g.textBaseline = 'middle';
  const e = easeOut(a);
  g.globalAlpha = Math.min(e, b);
  const trackIni = 26, trackFin = 6;
  espaciado(g, trackIni + (trackFin - trackIni) * e + (1 - b) * 10);
  g.font = `${peso} ${tam}px ${fuente}`;
  lineas.forEach((l, i) => {
    const yy = y + i * tam * 1.08 + (1 - e) * 24;
    const grad = g.createLinearGradient(0, yy - tam / 2, 0, yy + tam / 2);
    if (color === ORO) { grad.addColorStop(0, '#FFF1C2'); grad.addColorStop(0.5, '#FFC94A'); grad.addColorStop(1, '#C98A1E'); } else { grad.addColorStop(0, color); grad.addColorStop(1, color); }
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 30; g.shadowOffsetY = 6;
    g.lineWidth = 8; g.strokeStyle = 'rgba(20,10,0,0.85)'; g.lineJoin = 'round';
    g.strokeText(l, W / 2, yy);
    g.shadowColor = 'rgba(255,190,80,0.45)'; g.shadowBlur = 40 * e; g.shadowOffsetY = 0;
    g.fillStyle = grad; g.fillText(l, W / 2, yy);
    g.restore();
  });
  if (sub) {
    espaciado(g, 8);
    g.font = `700 ${Math.round(tam * 0.32)}px Montserrat`;
    textoContorno(g, sub, W / 2, y + lineas.length * tam * 1.08 + 10, { color: '#F3E6CC', grosor: 6, sombra: 12 });
  }
  g.restore();
}

// Etiqueta discreta (ej. RECONSTRUCCIÓN HIPOTÉTICA)
export function etiqueta(g, txt, t, ini, fin, { x = 60, y = 300, tam = 30, color = '#FFE2A0' } = {}) {
  if (t < ini || t > fin) return;
  const a = Math.min(clamp((t - ini) / 0.4), clamp((fin - t) / 0.4));
  g.save();
  g.globalAlpha = a;
  g.font = `700 ${tam}px Montserrat`;
  espaciado(g, 4);
  g.textBaseline = 'middle';
  const w = g.measureText(txt).width;
  g.fillStyle = 'rgba(15,10,4,0.55)';
  redondeado(g, x, y - tam * 0.95, w + tam * 2.2, tam * 1.9, 10); g.fill();
  g.strokeStyle = 'rgba(255,215,140,0.75)'; g.lineWidth = 2.5; g.stroke();
  // punto parpadeante
  g.fillStyle = color; g.beginPath(); g.arc(x + tam * 0.75, y, tam * 0.22, 0, Math.PI * 2); g.fill();
  g.fillStyle = color; g.fillText(txt, x + tam * 1.35, y + 1);
  g.restore();
}

// Rótulo de ubicación/fecha (estilo documental, línea dorada a la izquierda)
export function rotulo(g, l1, l2, t, ini, fin, { x = 70, y = 420 } = {}) {
  if (t < ini || t > fin) return;
  const a = easeOut(clamp((t - ini) / 0.5)), b = clamp((fin - t) / 0.4);
  g.save();
  g.globalAlpha = Math.min(a, b);
  g.fillStyle = ORO; g.fillRect(x, y - 40, 6, 96 * a);
  g.textBaseline = 'alphabetic';
  g.font = '800 40px Montserrat'; espaciado(g, 6);
  textoContorno(g, l1, x + 26 - (1 - a) * 20, y, { grosor: 7, sombra: 14 });
  g.font = '600 30px Montserrat'; espaciado(g, 3);
  textoContorno(g, l2, x + 26 - (1 - a) * 30, y + 46, { color: '#F1DFC0', grosor: 6, sombra: 12 });
  g.restore();
}

// Texto con formato de ecuación: AGUA + ARENA = MENOS FRICCIÓN
export function ecuacion(g, t, ini, fin, { y = 520 } = {}) {
  if (t < ini || t > fin) return;
  const W = g.canvas.width;
  const partes = [['AGUA', '#9FD8FF'], ['+', BLANCO], ['ARENA', '#F0C987'], ['=', BLANCO]];
  g.save();
  g.textBaseline = 'middle'; g.textAlign = 'center';
  g.font = '900 84px Montserrat'; espaciado(g, 2);
  const b = clamp((fin - t) / 0.4);
  const anchos = partes.map(([s]) => g.measureText(s).width);
  const esp = 26;
  const total = anchos.reduce((a, c) => a + c, 0) + esp * (partes.length - 1);
  let x = W / 2 - total / 2;
  partes.forEach(([s, c], i) => {
    const a = easeOutBack(clamp((t - ini - i * 0.18) / 0.3));
    g.save(); g.globalAlpha = clamp(a) * b;
    g.translate(x + anchos[i] / 2, y); g.scale(a, a);
    textoContorno(g, s, 0, 0, { color: c, grosor: 12 });
    g.restore();
    x += anchos[i] + esp;
  });
  const a2 = easeOutBack(clamp((t - ini - 0.8) / 0.35));
  g.save(); g.globalAlpha = clamp(a2) * b;
  g.translate(W / 2, y + 104); g.scale(a2, a2);
  g.font = '900 78px Montserrat';
  textoContorno(g, 'MENOS FRICCIÓN', 0, 0, { color: ORO, grosor: 12 });
  g.restore();
  g.restore();
}

// Barras comparativas de fuerza necesaria (arena seca vs. húmeda)
export function barrasFuerza(g, t, ini, fin, { y = 1560 } = {}) {
  if (t < ini || t > fin) return;
  const W = g.canvas.width;
  const a = easeOut(clamp((t - ini) / 0.5)), b = clamp((fin - t) / 0.4);
  const crece = easeInOut(clamp((t - ini - 0.3) / 1.2));
  g.save();
  g.globalAlpha = Math.min(a, b);
  const x0 = 120, ancho = W - 240;
  g.fillStyle = 'rgba(12,8,3,0.6)';
  redondeado(g, x0 - 30, y - 70, ancho + 60, 250, 22); g.fill();
  g.font = '800 30px Montserrat'; espaciado(g, 3); g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillStyle = '#F6E7CB'; g.fillText('FUERZA NECESARIA PARA ARRASTRAR', x0, y - 30);
  const filas = [['ARENA SECA', 1.0, '#E3B66F', '100%'], ['ARENA HÚMEDA', 0.5, '#7FC6F0', '≈ 50%']];
  filas.forEach(([n, v, c, lab], i) => {
    const yy = y + 30 + i * 74;
    g.font = '700 28px Montserrat'; g.fillStyle = BLANCO; g.fillText(n, x0, yy);
    const bx = x0 + 260, bw = ancho - 260 - 120;
    g.fillStyle = 'rgba(255,255,255,0.12)'; redondeado(g, bx, yy - 16, bw, 32, 16); g.fill();
    g.fillStyle = c; redondeado(g, bx, yy - 16, Math.max(32, bw * v * crece), 32, 16); g.fill();
    g.font = '800 30px Montserrat'; g.fillStyle = c; g.fillText(lab, bx + bw + 18, yy);
  });
  g.font = '600 21px Montserrat'; espaciado(g, 1); g.fillStyle = 'rgba(240,225,200,0.75)';
  g.fillText('Experimento de laboratorio: Fall et al., Physical Review Letters (2014)', x0, y + 162);
  g.restore();
}

// Contador de años (transición temporal)
export function contadorAnios(g, t, ini, fin, desde, hasta, { y = 1010 } = {}) {
  if (t < ini || t > fin) return;
  const W = g.canvas.width;
  const f = easeInOut(clamp((t - ini) / (fin - ini - 0.2)));
  const v = Math.round(desde + (hasta - desde) * f);
  const txt = v > 0 ? `${v} d. C.` : `${-v} a. C.`;
  const a = Math.min(clamp((t - ini) / 0.2), clamp((fin - t) / 0.2));
  g.save();
  g.globalAlpha = a;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 64px Montserrat'; espaciado(g, 4);
  textoContorno(g, txt, W / 2, y, { color: '#FFF3D6', grosor: 10 });
  g.restore();
}

// Rótulo para las alternativas de rampa
export function rotuloHipotesis(g, txt, t, ini, fin, { y = 760 } = {}) {
  if (t < ini || t > fin) return;
  const W = g.canvas.width;
  const a = easeOutBack(clamp((t - ini) / 0.3)), b = clamp((fin - t) / 0.2);
  g.save();
  g.globalAlpha = clamp(a) * b;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.translate(W / 2, y); g.scale(a, a);
  g.font = '900 70px Montserrat'; espaciado(g, 3);
  textoContorno(g, txt, 0, 0, { color: '#FFE7B0', grosor: 11 });
  g.restore();
}

export function inicioFin(t, ini, fin) { return inv(ini, fin, t); }

// Portada: degradado inferior y superior, título en tres líneas, sello de "reconstrucción animada"
export function portada(g, W, H) {
  g.save();
  let grd = g.createLinearGradient(0, 0, 0, H * 0.45);
  grd.addColorStop(0, 'rgba(10,6,2,0.78)'); grd.addColorStop(1, 'rgba(10,6,2,0)');
  g.fillStyle = grd; g.fillRect(0, 0, W, H * 0.45);
  grd = g.createLinearGradient(0, H * 0.62, 0, H);
  grd.addColorStop(0, 'rgba(10,6,2,0)'); grd.addColorStop(1, 'rgba(10,6,2,0.85)');
  g.fillStyle = grd; g.fillRect(0, H * 0.62, W, H * 0.38);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  espaciado(g, 6);
  const lineas = [['¿CÓMO', 150, BLANCO], ['CONSTRUYERON', 112, ORO], ['LAS PIRÁMIDES?', 112, ORO]];
  let y = 330;
  for (const [txt, tam, col] of lineas) {
    g.font = `900 ${tam}px Cinzel`;
    const ancho = g.measureText(txt).width;
    const esc = Math.min(1, (W - 90) / ancho);
    g.save(); g.translate(W / 2, y); g.scale(esc, esc);
    const gr2 = g.createLinearGradient(0, -tam / 2, 0, tam / 2);
    if (col === ORO) { gr2.addColorStop(0, '#FFF1C2'); gr2.addColorStop(0.5, '#FFC94A'); gr2.addColorStop(1, '#C98A1E'); } else { gr2.addColorStop(0, '#FFFFFF'); gr2.addColorStop(1, '#F1E2C6'); }
    g.shadowColor = 'rgba(0,0,0,0.75)'; g.shadowBlur = 34; g.shadowOffsetY = 8;
    g.lineWidth = 10; g.strokeStyle = 'rgba(20,10,0,0.9)'; g.lineJoin = 'round'; g.strokeText(txt, 0, 0);
    g.shadowColor = 'rgba(255,190,80,0.4)'; g.shadowBlur = 36; g.shadowOffsetY = 0;
    g.fillStyle = gr2; g.fillText(txt, 0, 0);
    g.restore();
    y += tam * 1.12;
  }
  g.font = '800 38px Montserrat'; espaciado(g, 8);
  textoContorno(g, 'RECONSTRUCCIÓN ANIMADA · GRAN PIRÁMIDE DE GUIZA', W / 2, H - 250, { color: '#F6E7CB', grosor: 7, sombra: 14 });
  g.fillStyle = ORO; g.fillRect(W / 2 - 90, H - 205, 180, 6);
  g.restore();
}
