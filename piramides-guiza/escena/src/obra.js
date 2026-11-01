// La obra en la meseta: pirámide en crecimiento, hilada en curso, rampa hipotética con
// convoyes de trineos tirados por equipos, cuadrillas con palancas en la plataforma superior.
import * as THREE from 'three';
import { Piramide, HiladaEnCurso, Revestimiento, Rampas, rampaFantasma, semi, ALTURA, SEMI_BASE } from './piramide.js';
import { Trineo, Cuerda, materiales, bloque } from './objetos.js';
import { alturaTerreno } from './mundo.js';
import { clamp, hash, mulberry32 } from './util.js';

const fr = (x) => x - Math.floor(x);

export class Obra {
  constructor(mundo) {
    this.mundo = mundo;
    this.grupo = new THREE.Group();
    this.piramide = new Piramide({ seed: 5 });
    this.enCurso = new HiladaEnCurso();
    this.revest = new Revestimiento();
    // plano adicional para recortar el revestimiento por encima del nivel actual
    this.planoTope = new THREE.Plane(new THREE.Vector3(0, -1, 0), ALTURA + 1);
    this.revest.mat.clippingPlanes = [this.revest.plano, this.planoTope];
    this.rampas = new Rampas();
    this.fantasmas = { recta: rampaFantasma('recta', 66), zigzag: rampaFantasma('zigzag', 66), espiral: rampaFantasma('espiral', 66) };
    this.grupo.add(this.piramide.grupo, this.enCurso.im, this.revest.malla, this.rampas.grupo);
    for (const k in this.fantasmas) this.grupo.add(this.fantasmas[k]);
    // piramidión (cima)
    this.piramidion = new THREE.Mesh(new THREE.ConeGeometry(1.45, 1.9, 4, 1), materiales().tura);
    this.piramidion.rotation.y = Math.PI / 4; this.piramidion.castShadow = true;
    this.grupo.add(this.piramidion);
    // convoyes
    this.nConvoy = 16;
    this.trineos = [];
    this.cuerdas = [];
    for (let i = 0; i < this.nConvoy; i++) {
      const tr = new Trineo({});
      this.trineos.push(tr); this.grupo.add(tr.grupo);
      for (let k = 0; k < 2; k++) { const c = new Cuerda(0.028); this.cuerdas.push(c); this.grupo.add(c.malla); }
    }
    // palancas y bloque en colocación (plataforma)
    const M = materiales();
    this.palancas = [];
    for (let i = 0; i < 2; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 3.4), M.madera); p.castShadow = true;
      const apoyo = bloque(0.4, 0.35, 0.4); apoyo.scale.setScalar(1);
      this.grupo.add(p, apoyo); this.palancas.push({ p, apoyo });
    }
    this.bloqueColoc = bloque(1.6, 1.0, 1.3);
    this.grupo.add(this.bloqueColoc);
    this.cuerdaColoc = new Cuerda(0.026); this.grupo.add(this.cuerdaColoc.malla);
    mundo.escena.add(this.grupo);
    this.h = 0;
  }

  visible(v) { this.grupo.visible = v; }

  // n = hiladas (continuo). Ajusta pirámide, hilada en curso y rampa.
  nivel(n, { rampa = true } = {}) {
    n = clamp(n, 0, this.piramide.n);
    const L = Math.floor(n), f = n - L;
    const p = this.piramide;
    p.nivel(L);
    const y0 = L * p.alto;
    this.h = y0;
    this.n = n;
    if (L < p.n) {
      this.enCurso.preparar(L, y0, semi(y0 + p.alto * 0.5) - 0.2, new THREE.Vector2(0, 1));
      this.enCurso.llenar(f);
      this.enCurso.im.visible = true;
    } else this.enCurso.im.visible = false;
    this.rampas.recta.visible = rampa && y0 > 1;
    if (rampa && y0 > 1) this.rampas.ajustar(y0);
    this.piramidion.visible = n >= p.n - 0.02;
    this.piramidion.position.set(0, p.n * p.alto + 0.5, 0);
    this.planoTope.constant = y0 + (L >= p.n ? 10 : 0.6);
  }

  // Convoyes de trineos subiendo la rampa; 'velocidad' en m/s (time-lapse posible)
  convoyes(t, multitud, { desde = 0, velocidad = 0.55, cuantos = this.nConvoy, porCuerda = 6, retorno = 40, plataforma = 18 } = {}) {
    const r = this.rampas;
    let k = desde;
    if (!r.recta.visible) { for (const tr of this.trineos) tr.grupo.visible = false; for (const c of this.cuerdas) c.malla.visible = false; return k; }
    const L = r.L, Ltot = L + 70; // recorrido: rampa + plataforma
    const dirRampa = new THREE.Vector3(0, r.h, -L).normalize();
    for (let i = 0; i < this.nConvoy; i++) {
      const tr = this.trineos[i];
      const usar = i < cuantos;
      tr.grupo.visible = usar;
      this.cuerdas[i * 2].malla.visible = this.cuerdas[i * 2 + 1].malla.visible = usar;
      if (!usar) continue;
      const d = fr(t * velocidad / Ltot + i / cuantos) * Ltot; // distancia recorrida
      const enRampa = d < L;
      const pos = (dd) => {
        if (dd < L) { const p = r.punto(dd / L); p.y += 0.02; return p; }
        const e = Math.min(dd - L, 60);
        return new THREE.Vector3(-20 + Math.sin(i * 1.7) * e * 0.4, r.h, semi(r.h) - e);
      };
      const p0 = pos(d);
      tr.grupo.position.copy(p0);
      const dir = enRampa ? dirRampa : new THREE.Vector3(0, 0, -1);
      tr.grupo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      tr.grupo.updateMatrixWorld();
      // equipo de arrastre
      const pts = [[], []];
      for (let c = 0; c < 2; c++) pts[c].push(tr.frente(c ? 0.45 : -0.45));
      for (let j = 0; j < porCuerda * 2; j++) {
        const w = multitud.t(k++);
        if (!w) break;
        const fila = Math.floor(j / 2), lado = j % 2 ? 1 : -1;
        const dd = d + 3.2 + fila * 1.15;
        const pw = pos(dd);
        const latX = lado * (0.85 + (fila % 2) * 0.12);
        const yawBase = enRampa || dd < L ? Math.PI : Math.PI;
        w.visible = true; w.accion = 'tirar'; w.ladoCuerda = -lado;
        w.pos.set(pw.x + latX, pw.y, pw.z);
        w.yaw = yawBase;
        w.fase = dd / (1.0 * w.escala) + w.desfase;
        const hom = w.pos.clone().add(new THREE.Vector3(-lado * 0.2 * 0, 1.32 * w.escala, -0.35));
        pts[j % 2].push(hom);
      }
      for (let c = 0; c < 2; c++) this.cuerdas[i * 2 + c].actualizar(pts[c], 0.1);
    }
    // trabajadores que bajan por el borde de la rampa
    for (let j = 0; j < retorno; j++) {
      const w = multitud.t(k++); if (!w) break;
      const d = fr(t * 1.1 / L + hash(j * 17) ) * L;
      const p = r.punto(1 - d / L);
      w.visible = true; w.accion = 'caminar';
      w.pos.set(p.x + 6.2 + hash(j * 3) * 1.2, p.y, p.z); w.yaw = 0; w.fase = d / (1.45 * w.escala) + w.desfase;
    }
    // cuadrillas en la plataforma
    const s = semi(r.h);
    const rnd = mulberry32(55);
    for (let j = 0; j < plataforma; j++) {
      const w = multitud.t(k++); if (!w) break;
      const ang = rnd() * 6.28, rad = rnd() * s * 0.8;
      w.visible = true; w.accion = rnd() < 0.5 ? 'parado' : 'caminar';
      const px = Math.cos(ang) * rad, pz = Math.sin(ang) * rad;
      if (w.accion === 'caminar') {
        const dd = t * 1.2 + rnd() * 50;
        const a2 = ang + dd / Math.max(8, rad);
        w.pos.set(Math.cos(a2) * rad, r.h + (this.enCurso.im.count > 0 ? 0.0 : 0), Math.sin(a2) * rad);
        w.yaw = -a2; w.fase = dd / (1.45 * w.escala);
      } else { w.pos.set(px, r.h, pz); w.yaw = rnd() * 6.28; w.vara = rnd() < 0.3; }
      // apoyar sobre bloques ya colocados de la hilada en curso
      w.pos.y = r.h + (this._sobreBloques(w.pos) ? 1.0 : 0);
    }
    return k;
  }

  _sobreBloques(p) {
    // estimación: la hilada en curso se llena desde el perímetro y luego desde el norte (z<0)
    const f = this.enCurso.total ? this.enCurso.im.count / this.enCurso.total : 0;
    const s = semi(this.h) - 0.2;
    if (Math.max(Math.abs(p.x), Math.abs(p.z)) > s - 3) return f > 0.15;
    const frente = -s + (f - 0.15) / 0.85 * 2 * s;
    return p.z < frente;
  }

  // Primer plano: un bloque se desliza con palancas hacia su hueco en la hilada en curso.
  // centro = (x del hueco, z de la fila interior); el empuje es hacia +z (borde sur).
  colocacion(t, multitud, k, { cx = -40, zFila = null } = {}) {
    const y = this.h;
    const s = semi(y);
    const zA = s - 0.8, zB = zFila ?? s - 2.25;
    if (!this.filasColoc) {
      const geo = this.bloqueColoc.geometry;
      this.filasColoc = new THREE.InstancedMesh(geo, materiales().caliza, 40);
      this.filasColoc.castShadow = this.filasColoc.receiveShadow = true;
      this.grupo.add(this.filasColoc);
    }
    const im = this.filasColoc;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    let n = 0;
    for (let i = -7; i <= 7; i++) {
      for (const [z, hueco] of [[zA, false], [zB, true]]) {
        if (hueco && i === 0) continue;
        if (hueco && Math.abs(i) > 5) continue;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (hash(i * 7 + (hueco ? 3 : 0)) - 0.5) * 0.03);
        m4.compose(new THREE.Vector3(cx + i * 1.65, y + 0.5, z), q, new THREE.Vector3(1, 1, 1));
        im.setMatrixAt(n, m4);
        const tt = 0.85 + hash(i * 13 + (hueco ? 5 : 1)) * 0.18; c.setRGB(tt, tt * 0.97, tt * 0.92); im.setColorAt(n, c);
        n++;
      }
    }
    im.count = n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.visible = true;
    const ciclo = 1.6;
    const fase = ((t - this.tColoc0) / ciclo) % 1;
    const empuje = Math.max(0, Math.sin(fase * Math.PI * 2)); // 0..1, medio ciclo activo
    const avance = clamp((t - this.tColoc0) / 3.0);
    const b = this.bloqueColoc;
    b.visible = true;
    const zb = zB - 1.25 * (1 - avance * avance * (3 - 2 * avance));
    b.position.set(cx, y + 0.5 + empuje * 0.05 * (1 - avance), zb);
    b.rotation.set(-empuje * 0.03 * (1 - avance), Math.PI / 2, 0);
    for (let i = 0; i < 2; i++) {
      const { p, apoyo } = this.palancas[i];
      p.visible = apoyo.visible = true;
      const x = cx + (i ? 0.42 : -0.42);
      const a = 0.42 - empuje * 0.22;
      const d = new THREE.Vector3(0, Math.sin(a), -Math.cos(a));
      const punta = new THREE.Vector3(x, y + 0.1, zb - 0.62);
      p.position.copy(punta).addScaledVector(d, 1.5);
      p.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
      apoyo.position.set(x, y + 0.17, zb - 1.0);
      for (let j = 0; j < 2; j++) {
        const w = multitud.t(k++); if (!w) return k;
        w.visible = true; w.accion = 'palanca'; w.frec = 1 / ciclo; w.desfase = -this.tColoc0 / ciclo - 0.25;
        w.pos.set(x + (j ? 0.3 : -0.3) * (i ? 1 : -1), y, zb - 0.62 - 2.95 - j * 0.12);
        w.yaw = 0;
      }
    }
    // capataz sobre la fila exterior y dos trabajadores esperando
    const extras = [[cx + 3.3, y + 1.0, zA, -2.6, 'parado', true], [cx - 3.2, y, zB - 2.6, 0.6, 'parado', false], [cx + 2.6, y, zB - 3.4, -0.9, 'parado', false]];
    for (const [x, yy, z, yaw, acc, vara] of extras) {
      const w = multitud.t(k++); if (!w) return k;
      w.visible = true; w.accion = acc; w.vara = vara; w.pos.set(x, yy, z); w.yaw = yaw;
    }
    this.cuerdaColoc.malla.visible = false;
    return k;
  }
  ocultarColocacion() {
    this.bloqueColoc.visible = false; this.cuerdaColoc.malla.visible = false;
    if (this.filasColoc) this.filasColoc.visible = false;
    for (const { p, apoyo } of this.palancas) p.visible = apoyo.visible = false;
  }

  // Revestimiento: f de revelado (de arriba hacia abajo)
  revestir(f) { this.revest.revelar(f); }
}

// trabajadores dispersos caminando entre dos puntos (ida y vuelta), sobre el terreno
export function caminantes(multitud, k, n, t, a, b, { seed = 1, ancho = 6, vel = 1.2, carga = 0.25 } = {}) {
  const L = a.distanceTo(b);
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  const nrm = new THREE.Vector3(-dir.z, 0, dir.x);
  for (let i = 0; i < n; i++) {
    const w = multitud.t(k++); if (!w) break;
    const h = hash(i * 31 + seed * 7);
    const ida = h < 0.5;
    const d = fr(t * vel / L + hash(i * 13 + seed)) * L;
    const p = ida ? a.clone().addScaledVector(dir, d) : b.clone().addScaledVector(dir, -d);
    p.addScaledVector(nrm, (hash(i * 5 + seed) - 0.5) * ancho);
    p.y = alturaTerreno(p.x, p.z);
    w.visible = true; w.accion = hash(i * 3 + seed) < carga ? 'cargar' : 'caminar';
    w.pos.copy(p);
    w.yaw = Math.atan2(dir.x, dir.z) + (ida ? 0 : Math.PI);
    w.fase = d / (1.45 * w.escala) + w.desfase;
  }
  return k;
}

export { SEMI_BASE, ALTURA };
