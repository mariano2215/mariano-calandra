// Texturas procedurales (sin assets externos): arena, caliza, hiladas de bloques,
// madera, adobe, lino, normales de agua. Todas repetibles (tileables) y deterministas.
import * as THREE from 'three';
import { hash2, mulberry32 } from './util.js';

// Ruido de valor periódico (tileable) con período p
function rp(x, y, p, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const m = (a) => ((a % p) + p) % p;
  const h = (i, j) => hash2(m(i) + s * 7919, m(j) + s * 104729);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
function fbmP(x, y, p, oct = 5, s = 0) {
  let t = 0, a = 1, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { t += a * rp(x * f, y * f, p * f, s + i); n += a; a *= 0.5; f *= 2; }
  return t / n;
}
// Ruido celular periódico (distancia al punto más cercano)
function celular(x, y, p, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 9, d2 = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j;
    const mx = ((cx % p) + p) % p, my = ((cy % p) + p) % p;
    const px = cx + hash2(mx + s * 31, my), py = cy + hash2(my + s * 17, mx + 3);
    const d = Math.hypot(px - x, py - y);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return [d1, d2];
}

function lienzo(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

// Construye mapas de color, normales y rugosidad a partir de funciones.
function construir({ w, h = w, altura, color, rug, fuerza = 2.0, repetir = true }) {
  const H = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) H[y * w + x] = altura(x / w, y / h, x, y);
  const cc = lienzo(w, h), cn = lienzo(w, h), cr = lienzo(w, h);
  const ic = cc.getContext('2d').createImageData(w, h);
  const inn = cn.getContext('2d').createImageData(w, h);
  const ir = cr.getContext('2d').createImageData(w, h);
  const at = (x, y) => H[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, o = i * 4;
    const dx = (at(x + 1, y) - at(x - 1, y)) * fuerza * w / 512;
    const dy = (at(x, y + 1) - at(x, y - 1)) * fuerza * h / 512;
    const n = new THREE.Vector3(-dx, dy, 1).normalize();
    inn.data[o] = (n.x * 0.5 + 0.5) * 255; inn.data[o + 1] = (n.y * 0.5 + 0.5) * 255; inn.data[o + 2] = (n.z * 0.5 + 0.5) * 255; inn.data[o + 3] = 255;
    const [r, g, b] = color(x / w, y / h, H[i], x, y);
    ic.data[o] = r; ic.data[o + 1] = g; ic.data[o + 2] = b; ic.data[o + 3] = 255;
    const rv = rug ? rug(x / w, y / h, H[i]) : 230;
    ir.data[o] = rv; ir.data[o + 1] = rv; ir.data[o + 2] = rv; ir.data[o + 3] = 255;
  }
  cc.getContext('2d').putImageData(ic, 0, 0);
  cn.getContext('2d').putImageData(inn, 0, 0);
  cr.getContext('2d').putImageData(ir, 0, 0);
  const tex = (c, srgb) => {
    const t = new THREE.CanvasTexture(c);
    if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };
  return { map: tex(cc, true), normalMap: tex(cn, false), roughnessMap: tex(cr, false) };
}

const mezclar = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function texArena(seco = true) {
  const base = seco ? [214, 178, 128] : [150, 112, 74];
  const osc = seco ? [176, 136, 92] : [112, 80, 52];
  return construir({
    w: 512,
    altura: (u, v) => {
      // ondulaciones de viento + grano
      const rip = Math.sin((u * 18 + fbmP(u * 4, v * 4, 4, 3, 2) * 1.6) * Math.PI * 2) * 0.35;
      return rip * (seco ? 1 : 0.4) + fbmP(u * 64, v * 64, 64, 2, 5) * 0.5 + fbmP(u * 8, v * 8, 8, 4, 9) * 0.6;
    },
    color: (u, v, hh, x, y) => {
      const n = fbmP(u * 6, v * 6, 6, 4, 3) * 0.5 + 0.5;
      const g = hash2(x, y);
      let c = mezclar(osc, base, n * 0.8 + 0.2);
      const k = 0.9 + g * 0.2 + hh * 0.05;
      if (g > 0.985) c = mezclar(c, [120, 96, 72], 0.6); // piedritas
      return [c[0] * k, c[1] * k, c[2] * k];
    },
    rug: () => (seco ? 245 : 150),
    fuerza: 1.4,
  });
}

// Caliza de cantera/bloque (superficie labrada)
export function texCaliza(tono = [206, 186, 150], seed = 1, pulida = false, marcasOn = true) {
  return construir({
    w: 512,
    altura: (u, v) => {
      const [d1, d2] = celular(u * 10, v * 10, 10, seed);
      const poros = Math.max(0, 0.06 - d1 * 0.15);
      const marcas = (pulida || !marcasOn) ? 0 : Math.sin((u * 40 + fbmP(u * 6, v * 6, 6, 3, seed) * 2) * Math.PI * 2) * 0.08;
      return fbmP(u * 8, v * 8, 8, 5, seed + 3) * (pulida ? 0.15 : 0.9) + marcas - poros * 4 + (d2 - d1) * (pulida ? 0.02 : 0.15);
    },
    color: (u, v, hh, x, y) => {
      const n = fbmP(u * 5, v * 5, 5, 4, seed + 7) * 0.5 + 0.5;
      const veta = Math.abs(fbmP(u * 3, v * 12, 3, 4, seed + 11));
      const g = 0.92 + hash2(x + seed, y) * 0.1;
      let c = mezclar([tono[0] * 0.82, tono[1] * 0.8, tono[2] * 0.76], tono, n);
      if (veta < 0.04) c = mezclar(c, [tono[0] * 0.75, tono[1] * 0.7, tono[2] * 0.62], 0.5);
      return [c[0] * g + hh * 8, c[1] * g + hh * 8, c[2] * g + hh * 7];
    },
    rug: (u, v, hh) => (pulida ? 120 + hh * 40 : 225 + hh * 20),
    fuerza: pulida ? 0.6 : 2.2,
  });
}

// Hiladas de bloques (paredes escalonadas de la pirámide): una hilada por textura en V,
// juntas verticales irregulares. 1 unidad U = 8 m de pared aprox.
export function texHiladas(seed = 3) {
  const W = 1024, Hh = 256;
  const rnd = mulberry32(seed);
  // posiciones de juntas en 4 filas (variantes), cada una 8 m → bloques 1–2.2 m
  const filas = [];
  for (let f = 0; f < 4; f++) {
    const j = [0]; let x = 0;
    while (x < 1) { x += (1.0 + rnd() * 1.2) / 8; j.push(Math.min(1, x)); }
    filas.push(j);
  }
  const tonos = [];
  for (let f = 0; f < 4; f++) tonos.push(filas[f].map(() => 0.86 + rnd() * 0.22));
  return construir({
    w: W, h: Hh,
    altura: (u, v) => {
      const f = Math.min(3, Math.floor(v * 4));
      const vv = v * 4 - f;
      const js = filas[f];
      let dmin = 1;
      for (const jx of js) dmin = Math.min(dmin, Math.abs(u - jx) * 8 * 4); // en "m" aprox
      const borde = Math.min(vv, 1 - vv) * 1.0; // borde de hilada
      const jun = Math.min(dmin, borde * 1.4);
      const bisel = Math.min(1, jun / 0.06);
      return (bisel - 1) * 1.4 + fbmP(u * 32, v * 8, 32, 4, seed) * 0.35;
    },
    color: (u, v, hh, x, y) => {
      const f = Math.min(3, Math.floor(v * 4));
      const js = filas[f];
      let k = 0; while (k < js.length - 1 && u > js[k + 1]) k++;
      const t = tonos[f][k];
      const n = fbmP(u * 16, v * 4, 16, 4, seed + 5) * 0.5 + 0.5;
      const c = mezclar([170, 146, 110], [214, 192, 152], n);
      const sombra = hh < -0.6 ? 0.55 : 1;
      const g = 0.95 + hash2(x, y + seed) * 0.08;
      return [c[0] * t * sombra * g, c[1] * t * sombra * g, c[2] * t * sombra * g];
    },
    rug: () => 235,
    fuerza: 3.0,
  });
}

export function texMadera(seed = 2) {
  return construir({
    w: 256, h: 512,
    altura: (u, v) => Math.sin((u * 30 + fbmP(u * 4, v * 2, 4, 3, seed) * 3) * Math.PI) * 0.2 + fbmP(u * 8, v * 32, 8, 3, seed + 1) * 0.3,
    color: (u, v, hh) => {
      const g = Math.sin((u * 30 + fbmP(u * 4, v * 2, 4, 3, seed) * 3) * Math.PI) * 0.5 + 0.5;
      const c = mezclar([92, 62, 38], [140, 100, 64], g * 0.7 + fbmP(u * 6, v * 20, 6, 3, seed + 4) * 0.3);
      return c;
    },
    rug: () => 200, fuerza: 1.2,
  });
}

export function texAdobe(seed = 4) {
  // adobe y escombro de rampa: ladrillos de barro irregulares
  return construir({
    w: 512,
    altura: (u, v) => {
      const fila = Math.floor(v * 16), vv = v * 16 - fila;
      const off = (fila % 2) * 0.5;
      const uu = u * 8 + off, cu = uu - Math.floor(uu);
      const jun = Math.min(vv, 1 - vv, cu * 2, (1 - cu) * 2);
      return Math.min(1, jun / 0.12) * 0.8 + fbmP(u * 24, v * 24, 24, 4, seed) * 0.45;
    },
    color: (u, v, hh, x, y) => {
      const n = fbmP(u * 6, v * 6, 6, 4, seed + 2) * 0.5 + 0.5;
      const c = mezclar([118, 86, 58], [160, 122, 84], n);
      const k = (hh < 0.3 ? 0.78 : 1) * (0.94 + hash2(x, y) * 0.1);
      return [c[0] * k, c[1] * k, c[2] * k];
    },
    rug: () => 245, fuerza: 2.0,
  });
}

export function texLino() {
  return construir({
    w: 128,
    altura: (u, v, x, y) => ((x % 2) ^ (y % 2)) * 0.3 + fbmP(u * 8, v * 32, 8, 2, 3) * 0.4,
    color: (u, v, hh) => { const k = 0.93 + hh * 0.08; return [236 * k, 226 * k, 204 * k]; },
    rug: () => 240, fuerza: 1.0,
  });
}

export function texCuerda() {
  return construir({
    w: 64, h: 256,
    altura: (u, v) => Math.sin((v * 24 + u * 2) * Math.PI * 2) * 0.5,
    color: (u, v, hh) => { const k = 0.8 + hh * 0.25; return [168 * k, 136 * k, 88 * k]; },
    rug: () => 250, fuerza: 2.0,
  });
}

export function normalesAgua() {
  const t = construir({
    w: 512,
    altura: (u, v) => fbmP(u * 8, v * 8, 8, 5, 21) * 0.8 + fbmP(u * 24 + 0.3, v * 24, 24, 3, 23) * 0.25,
    color: () => [0, 0, 0], fuerza: 3.0,
  });
  return t.normalMap;
}

// Textura de suelo de campos (verde con parcelas) para el valle del Nilo
export function texCampos() {
  return construir({
    w: 512,
    altura: (u, v) => {
      const pu = u * 6, pv = v * 6;
      const cu = pu - Math.floor(pu), cv = pv - Math.floor(pv);
      const borde = Math.min(cu, 1 - cu, cv, 1 - cv);
      return Math.min(1, borde / 0.03) * 0.3 + fbmP(u * 40, v * 40, 40, 3, 30) * 0.3;
    },
    color: (u, v, hh) => {
      const pi = Math.floor(u * 6), pj = Math.floor(v * 6);
      const t = hash2(pi + 3, pj + 9);
      const verdes = [[78, 104, 44], [96, 120, 52], [120, 128, 60], [140, 120, 70], [66, 92, 40]];
      const c = verdes[Math.floor(t * verdes.length)];
      const k = (hh < 0.15 ? 0.7 : 1) * (0.9 + fbmP(u * 30, v * 30, 30, 3, 31) * 0.15);
      return [c[0] * k, c[1] * k, c[2] * k];
    },
    rug: () => 235, fuerza: 1.0,
  });
}

export function texPolvo() {
  // sprite suave para partículas de polvo / humo
  const c = lienzo(128, 128), g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const img = g.getImageData(0, 0, 128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const o = (y * 128 + x) * 4;
    const n = fbmP(x / 128 * 4, y / 128 * 4, 4, 4, 41) * 0.5 + 0.5;
    img.data[o + 3] *= 0.5 + n * 0.7;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
