// Gran Pirámide: hiladas escalonadas que crecen, bloques de la hilada en curso,
// revestimiento de caliza de Tura (con revelado de arriba hacia abajo), versión actual
// erosionada, Kefrén y Micerino (vistas actuales) y rampas hipotéticas.
import * as THREE from 'three';
import { mulberry32, clamp } from './util.js';
import * as TX from './texturas.js';

export const ALTURA = 146.6;
export const SEMI_BASE = 115.2;
export const HILADA = 1.0;
export const N_HILADAS = 146;
export const semi = (y, H = ALTURA, S = SEMI_BASE) => S * (1 - y / H);

// Geometría de hiladas (lados + pisadas) no indexada, para crecer con drawRange
function geometriaHiladas({ H, S, n, alto, seed = 1, retranqueo = 0.5 }) {
  const rnd = mulberry32(seed);
  const lados = [], uvL = [], norL = [];
  const tops = [], uvT = [], norT = [];
  for (let i = 0; i < n; i++) {
    const y0 = i * alto, y1 = (i + 1) * alto;
    const s = Math.max(0.6, S * (1 - (y0 + alto * retranqueo) / H));
    const fila = i % 4, v0 = fila / 4 + 0.002, v1 = (fila + 1) / 4 - 0.002;
    const off = rnd() * 10;
    const caras = [
      [[-s, s], [s, s], [0, 0, 1]],
      [[s, s], [s, -s], [1, 0, 0]],
      [[s, -s], [-s, -s], [0, 0, -1]],
      [[-s, -s], [-s, s], [-1, 0, 0]],
    ];
    for (const [[ax, az], [bx, bz], nn] of caras) {
      const L = 2 * s, u0 = off, u1 = off + L / 8;
      const A = [ax, y0, az], B = [bx, y0, bz], C = [bx, y1, bz], D = [ax, y1, az];
      lados.push(...A, ...B, ...C, ...A, ...C, ...D);
      uvL.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
      for (let k = 0; k < 6; k++) norL.push(...nn);
    }
    // pisada superior
    const T = (x, z) => [x, y1, z];
    tops.push(...T(-s, s), ...T(s, s), ...T(s, -s), ...T(-s, s), ...T(s, -s), ...T(-s, -s));
    const k = 1 / 6;
    uvT.push(-s * k, s * k, s * k, s * k, s * k, -s * k, -s * k, s * k, s * k, -s * k, -s * k, -s * k);
    for (let j = 0; j < 6; j++) norT.push(0, 1, 0);
  }
  const mk = (p, uv, nn) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3));
    return g;
  };
  return { lados: mk(lados, uvL, norL), tops: mk(tops, uvT, norT), vertsLado: 24, vertsTop: 6 };
}

export class Piramide {
  constructor({ H = ALTURA, S = SEMI_BASE, n = N_HILADAS, seed = 5, tono = 1, erosion = 0, posicion = new THREE.Vector3() } = {}) {
    this.H = H; this.S = S; this.n = n; this.alto = H / n * (n / (H / HILADA)) || HILADA;
    this.alto = HILADA * (H / ALTURA);
    this.grupo = new THREE.Group();
    this.grupo.position.copy(posicion);
    const hil = TX.texHiladas(seed);
    const los = TX.texCaliza([200, 178, 140], seed + 2);
    const tint = new THREE.Color().setRGB(tono, tono * 0.985, tono * 0.96);
    this.matLados = new THREE.MeshStandardMaterial({ map: hil.map, normalMap: hil.normalMap, roughness: 0.93,
      normalScale: new THREE.Vector2(1.2 + erosion, 1.2 + erosion), color: tint });
    this.matTops = new THREE.MeshStandardMaterial({ map: los.map, normalMap: los.normalMap, roughness: 0.95, color: tint });
    const g = geometriaHiladas({ H, S, n, alto: this.alto, seed });
    this.geo = g;
    this.mLados = new THREE.Mesh(g.lados, this.matLados);
    this.mTops = new THREE.Mesh(g.tops, this.matTops);
    for (const m of [this.mLados, this.mTops]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; }
    this.grupo.add(this.mLados, this.mTops);
    this.nivel(n);
  }

  // Hiladas completas visibles
  nivel(k) {
    k = Math.max(0, Math.min(this.n, Math.floor(k)));
    this.k = k;
    this.mLados.geometry.setDrawRange(0, k * this.geo.vertsLado);
    this.mTops.geometry.setDrawRange(0, k * this.geo.vertsTop);
    this.mLados.visible = this.mTops.visible = k > 0;
  }
  alturaNivel(k = this.k) { return k * this.alto; }
}

// Bloques individuales de la hilada en curso (sobre la plataforma de trabajo)
export class HiladaEnCurso {
  constructor(maxBloques = 26000) {
    const geo = new THREE.BoxGeometry(1.36, 0.96, 1.36);
    const cal = TX.texCaliza([208, 186, 146], 9);
    this.mat = new THREE.MeshStandardMaterial({ map: cal.map, normalMap: cal.normalMap, roughness: 0.92 });
    this.im = new THREE.InstancedMesh(geo, this.mat, maxBloques);
    this.im.castShadow = true; this.im.receiveShadow = true;
    this.im.count = 0;
    this.im.frustumCulled = false;
    this.max = maxBloques;
    this.claveActual = null;
    this.orden = [];
  }
  // Prepara las posiciones de la hilada k (base y0, semilado s), orden de llenado desde 'llegada'
  preparar(k, y0, s, llegada = new THREE.Vector2(0, 1)) {
    const clave = `${k}`;
    if (clave === this.claveActual) return;
    this.claveActual = clave;
    const paso = 1.45, n = Math.floor((2 * s) / paso);
    const off = -((n - 1) * paso) / 2;
    const pts = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) pts.push([off + i * paso, off + j * paso]);
    // primero el perímetro (bloques de revestimiento/borde), luego hacia el centro desde el lado opuesto a la llegada
    const L = new THREE.Vector2(llegada.x, llegada.y).normalize();
    pts.sort((a, b) => {
      const pa = Math.max(Math.abs(a[0]), Math.abs(a[1])) > s - 3 ? 1 : 0;
      const pb = Math.max(Math.abs(b[0]), Math.abs(b[1])) > s - 3 ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return (a[0] * L.x + a[1] * L.y) - (b[0] * L.x + b[1] * L.y);
    });
    const total = Math.min(this.max, pts.length);
    const m4 = new THREE.Matrix4(), c = new THREE.Color(), rnd = mulberry32(k * 31 + 7), q = new THREE.Quaternion();
    for (let i = 0; i < total; i++) {
      const [x, z] = pts[i];
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (rnd() - 0.5) * 0.03);
      m4.compose(new THREE.Vector3(x + (rnd() - 0.5) * 0.06, y0 + 0.48, z + (rnd() - 0.5) * 0.06), q, new THREE.Vector3(1, 0.97 + rnd() * 0.06, 1));
      this.im.setMatrixAt(i, m4);
      const t = 0.84 + rnd() * 0.2; c.setRGB(t, t * 0.97, t * 0.92);
      this.im.setColorAt(i, c);
    }
    this.im.instanceMatrix.needsUpdate = true;
    if (this.im.instanceColor) this.im.instanceColor.needsUpdate = true;
    this.total = total;
  }
  llenar(f) { this.im.count = Math.floor(clamp(f) * (this.total || 0)); }
}

// Revestimiento liso de caliza blanca: 4 caras triangulares, revelado por plano de recorte
export class Revestimiento {
  constructor({ H = ALTURA, S = SEMI_BASE, alturaMax = H } = {}) {
    const cal = TX.texCaliza([236, 226, 204], 13, true);
    for (const t of [cal.map, cal.normalMap, cal.roughnessMap]) t.repeat.set(10, 10);
    this.plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.mat = new THREE.MeshStandardMaterial({ map: cal.map, normalMap: cal.normalMap, roughnessMap: cal.roughnessMap,
      normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.55, metalness: 0, clippingPlanes: [this.plano], clipShadows: true });
    const pts = [], uvs = [];
    const a = alturaMax / H, sTop = S * (1 - a);
    const caras = [[[-S, S], [S, S]], [[S, S], [S, -S]], [[S, -S], [-S, -S]], [[-S, -S], [-S, S]]];
    for (const [[ax, az], [bx, bz]] of caras) {
      const tx1 = ax * (1 - a), tz1 = az * (1 - a), tx2 = bx * (1 - a), tz2 = bz * (1 - a);
      // trapecio (o triángulo si alturaMax = H), con pequeño desplazamiento hacia afuera
      pts.push(ax, 0, az, bx, 0, bz, tx2, alturaMax, tz2, ax, 0, az, tx2, alturaMax, tz2, tx1, alturaMax, tz1);
      const L = 2 * S / 23;
      uvs.push(0, 0, L, 0, L * (0.5 + (1 - a) / 2), alturaMax / 23, 0, 0, L * (0.5 + (1 - a) / 2), alturaMax / 23, L * (0.5 - (1 - a) / 2), alturaMax / 23);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.computeVertexNormals();
    // inflar levemente para cubrir los escalones
    const p = g.attributes.position, nn = g.attributes.normal;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + nn.getX(i) * 0.9, p.getY(i), p.getZ(i) + nn.getZ(i) * 0.9);
    this.malla = new THREE.Mesh(g, this.mat);
    this.malla.castShadow = true; this.malla.receiveShadow = true;
    this.revelar(0);
  }
  // f=0 nada, f=1 todo: de arriba hacia abajo
  revelar(f, H = ALTURA) {
    const corte = H * (1 - clamp(f)) - 0.5;
    this.plano.constant = -corte;
    this.malla.visible = f > 0.0001;
  }
}

// Rampa hipotética recta (lado sur): adobe y cascajo, taludes laterales 0,7:1
export class Rampas {
  constructor() {
    const ad = TX.texAdobe(4);
    this.matAdobe = new THREE.MeshStandardMaterial({ map: ad.map, normalMap: ad.normalMap, roughness: 0.97, color: 0xf2e6d0 });
    this.geoRecta = new THREE.BufferGeometry();
    this.recta = new THREE.Mesh(this.geoRecta, this.matAdobe);
    this.recta.castShadow = true; this.recta.receiveShadow = true;
    this.recta.frustumCulled = false;
    this.grupo = new THREE.Group();
    this.grupo.add(this.recta);
    this.pendiente = 1 / 7.5;
    this.ancho = 16;
    this.x = -20;
    this.h = -1;
  }
  ajustar(h) {
    this.recta.visible = h > 0.5;
    if (Math.abs(h - this.h) < 0.02) return;
    const L = h / this.pendiente, s = semi(h), a = this.ancho / 2, x0 = this.x, talud = 0.7;
    const pos = [], uv = [];
    const N = 16;
    const quad = (A, B, C, D, ua, ub) => { pos.push(...A, ...B, ...C, ...A, ...C, ...D); uv.push(...ua[0], ...ua[1], ...ub[1], ...ua[0], ...ub[1], ...ub[0]); };
    for (let i = 0; i < N; i++) {
      const u0 = i / N * L, u1 = (i + 1) / N * L;
      const y0 = h * (1 - u0 / L), y1 = h * (1 - u1 / L);
      const z0 = s + u0, z1 = s + u1;
      // superficie de rodadura
      quad([x0 - a, y0, z0], [x0 + a, y0, z0], [x0 + a, y1, z1], [x0 - a, y1, z1],
        [[0, z0 / 6], [a * 2 / 6, z0 / 6]], [[0, z1 / 6], [a * 2 / 6, z1 / 6]]);
      // taludes
      quad([x0 + a, y0, z0], [x0 + a + talud * y0, 0, z0], [x0 + a + talud * y1, 0, z1], [x0 + a, y1, z1],
        [[0, z0 / 6], [y0 / 5, z0 / 6]], [[0, z1 / 6], [y1 / 5, z1 / 6]]);
      quad([x0 - a - talud * y0, 0, z0], [x0 - a, y0, z0], [x0 - a, y1, z1], [x0 - a - talud * y1, 0, z1],
        [[y0 / 5, z0 / 6], [0, z0 / 6]], [[y1 / 5, z1 / 6], [0, z1 / 6]]);
    }
    // corregir el orden de uv (pares por vértice)
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const uvs = [];
    for (let i = 0; i < pos.length / 3; i++) uvs.push((pos[i * 3] - x0) / 6 + pos[i * 3 + 1] / 8, pos[i * 3 + 2] / 6);
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.computeVertexNormals();
    this.recta.geometry.dispose();
    this.recta.geometry = g; this.geoRecta = g;
    this.L = L; this.h = h;
  }
  punto(f) {
    return new THREE.Vector3(this.x, this.h * f, semi(this.h) + this.L * (1 - f));
  }
}

// Fantasmas de hipótesis alternativas (recta, zigzag, espiral) como hologramas
export function rampaFantasma(tipo, h = 90) {
  const pts = [];
  const salida = 4;
  if (tipo === 'espiral') {
    const vueltas = 1.6, N = 220;
    for (let i = 0; i <= N; i++) {
      const f = i / N, y = f * h;
      const s = semi(y) + salida;
      // recorrido por el perímetro
      const per = f * vueltas * 4;
      const lado = Math.floor(per) % 4, t = per - Math.floor(per);
      const c = [[-s, s], [s, s], [s, -s], [-s, -s], [-s, s]];
      const a = c[lado], b = c[lado + 1];
      pts.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t));
    }
  } else if (tipo === 'zigzag') {
    const tramos = 6, N = 40;
    for (let k = 0; k < tramos; k++) for (let i = 0; i <= N; i++) {
      const f = (k + i / N) / tramos, y = f * h;
      const s = semi(y);
      const dir = k % 2 === 0 ? 1 : -1, t = i / N;
      const x = (dir > 0 ? -0.6 + 1.2 * t : 0.6 - 1.2 * t) * s * 0.8;
      pts.push(new THREE.Vector3(x, y, s + salida));
    }
  } else {
    const L = h * 7.5;
    for (let i = 0; i <= 20; i++) { const f = i / 20; pts.push(new THREE.Vector3(-20, h * f, semi(h) + L * (1 - f))); }
  }
  // cinta con espesor
  const ancho = tipo === 'recta' ? 16 : 7;
  const v = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const t = new THREE.Vector3().subVectors(b, a); t.y = 0; t.normalize();
    const nrm = new THREE.Vector3(-t.z, 0, t.x);
    const a1 = a.clone().addScaledVector(nrm, ancho / 2), a2 = a.clone().addScaledVector(nrm, -ancho / 2);
    const b1 = b.clone().addScaledVector(nrm, ancho / 2), b2 = b.clone().addScaledVector(nrm, -ancho / 2);
    v.push(...a1.toArray(), ...b1.toArray(), ...b2.toArray(), ...a1.toArray(), ...b2.toArray(), ...a2.toArray());
    const a3 = a1.clone(), b3 = b1.clone(); a3.y -= 3; b3.y -= 3;
    v.push(...a1.toArray(), ...a3.toArray(), ...b3.toArray(), ...a1.toArray(), ...b3.toArray(), ...b1.toArray());
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd889, transparent: true, opacity: 0.35, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const m = new THREE.Mesh(g, mat);
  const lin = new THREE.LineSegments(new THREE.EdgesGeometry(g, 25),
    new THREE.LineBasicMaterial({ color: 0xffe7b0, transparent: true, opacity: 0.9, fog: false, depthWrite: false }));
  const grupo = new THREE.Group(); grupo.add(m, lin);
  grupo.userData = { mat, matLin: lin.material };
  grupo.visible = false;
  return grupo;
}
