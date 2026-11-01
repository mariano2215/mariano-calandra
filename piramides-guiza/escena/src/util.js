// Utilidades deterministas: azar con semilla, ruido, interpolación y curvas de cámara.
import * as THREE from 'three';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash entero → [0,1)
export function hash(n) {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
export function hash2(i, j) { return hash(i * 73856093 ^ j * 19349663); }

// Ruido de valor 2D suave (determinista)
export function ruido2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
export function fbm2(x, y, oct = 5, lac = 2.0, gan = 0.5) {
  let s = 0, a = 1, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * ruido2(x * f + i * 17.3, y * f - i * 9.1); n += a; a *= gan; f *= lac; }
  return s / n;
}
export function ruido1(x, seed = 0) { return ruido2(x, seed * 13.37); }

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (x) => x * x * (3 - 2 * x);
export const smoother = (x) => x * x * x * (x * (x * 6 - 15) + 10);
export const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeOut = (x) => 1 - Math.pow(1 - x, 3);
export const easeIn = (x) => x * x * x;
export const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
export const ventana = (t, a, b, fi = 0.3, fo = 0.3) => clamp(Math.min((t - a) / fi, (b - t) / fo));

// Interpolación de claves con Catmull-Rom centrípeta sobre [t, valor(Vector3|number)]
export class Pista {
  constructor(claves, { suave = true } = {}) {
    this.claves = claves; this.suave = suave;
  }
  valor(t) {
    const k = this.claves;
    if (t <= k[0][0]) return clon(k[0][1]);
    if (t >= k[k.length - 1][0]) return clon(k[k.length - 1][1]);
    let i = 0;
    while (i < k.length - 2 && t > k[i + 1][0]) i++;
    const t0 = k[i][0], t1 = k[i + 1][0];
    let u = (t - t0) / (t1 - t0);
    const p0 = k[Math.max(0, i - 1)][1], p1 = k[i][1], p2 = k[i + 1][1], p3 = k[Math.min(k.length - 1, i + 2)][1];
    return catmull(p0, p1, p2, p3, u);
  }
}
function clon(v) { return typeof v === 'number' ? v : v.clone(); }
function cr(a, b, c, d, u) {
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * ((2 * b) + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
}
function catmull(p0, p1, p2, p3, u) {
  if (typeof p1 === 'number') return cr(p0, p1, p2, p3, u);
  return new THREE.Vector3(cr(p0.x, p1.x, p2.x, p3.x, u), cr(p0.y, p1.y, p2.y, p3.y, u), cr(p0.z, p1.z, p2.z, p3.z, u));
}

// Movimiento de cámara en mano sutil (determinista)
export function temblor(t, amp = 1, seed = 1) {
  return new THREE.Vector3(
    fbm2(t * 0.7, seed, 3) * amp,
    fbm2(t * 0.6, seed + 5, 3) * amp,
    fbm2(t * 0.5, seed + 11, 3) * amp,
  );
}

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
