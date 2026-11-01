// Cantera de caliza al sur de la pirámide: paredes talladas, piso de roca, retícula de bloques
// en distintas etapas de corte, rampa de salida, bloque protagonista y sus trabajadores.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CANTERA, alturaTerreno } from './mundo.js';
import { materiales, Trineo, Cuerda, bloque, Esquirlas, Particulas, emitirPolvo } from './objetos.js';
import * as TX from './texturas.js';
import { hash, mulberry32, clamp, smooth } from './util.js';

export const PISO = -CANTERA.prof;
const X0 = CANTERA.x - CANTERA.ancho / 2 - 4, X1 = CANTERA.x + CANTERA.ancho / 2 + 4;
const Z0 = CANTERA.z - CANTERA.largo / 2 - 4, Z1 = CANTERA.z + CANTERA.largo / 2 + 4;
export const HEROE = { x: CANTERA.x - 6, z: CANTERA.z + 4 };
const PASO_X = 1.95, PASO_Z = 1.6; // retícula (bloque 1.6 × 1.25 + canales)
const BW = 1.6, BH = 1.15, BD = 1.25;

export class Cantera {
  constructor(mundo) {
    this.grupo = new THREE.Group();
    const M = materiales();
    const pared = TX.texCaliza([200, 180, 146], 31);
    for (const t of [pared.map, pared.normalMap, pared.roughnessMap]) t.repeat.set(6, 2);
    const matPared = new THREE.MeshStandardMaterial({ map: pared.map, normalMap: pared.normalMap, roughnessMap: pared.roughnessMap, normalScale: new THREE.Vector2(1.6, 1.6) });
    // paredes (con hueco al este para la rampa de salida)
    const alto = CANTERA.prof + 2.5;
    const mkPared = (x, z, w, d) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, alto, d), matPared);
      m.position.set(x, PISO + alto / 2 - 0.6, z); m.castShadow = m.receiveShadow = true; this.grupo.add(m);
    };
    const e = 3;
    mkPared((X0 + X1) / 2, Z0 - e / 2, X1 - X0 + 2 * e, e);
    mkPared((X0 + X1) / 2, Z1 + e / 2, X1 - X0 + 2 * e, e);
    mkPared(X0 - e / 2, (Z0 + Z1) / 2, e, Z1 - Z0);
    const zr0 = HEROE.z - 7, zr1 = HEROE.z + 7;
    mkPared(X1 + e / 2, (Z0 + zr0) / 2, e, zr0 - Z0);
    mkPared(X1 + e / 2, (zr1 + Z1) / 2, e, Z1 - zr1);
    // bancos escalonados en la pared norte y oeste
    for (const [x, z, w, d] of [[(X0 + X1) / 2, Z0 + 2.5, X1 - X0, 5], [X0 + 3, (Z0 + Z1) / 2, 6, Z1 - Z0]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 5.5, d), matPared);
      m.position.set(x, PISO + 2.75, z); m.castShadow = m.receiveShadow = true; this.grupo.add(m);
    }
    // piso de roca
    const piso = TX.texCaliza([196, 176, 140], 33, false, false);
    for (const t of [piso.map, piso.normalMap]) t.repeat.set(30, 22);
    const mp = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: piso.map, normalMap: piso.normalMap, roughness: 0.96, color: 0xe8dcc8 }));
    mp.position.set((X0 + X1) / 2, PISO + 0.02, (Z0 + Z1) / 2); mp.receiveShadow = true; this.grupo.add(mp);
    // rampa de salida al este
    const L = 46, H = -PISO + alturaTerreno(X1 + 30, HEROE.z) + 0.2;
    const rg = new THREE.BoxGeometry(L, 1, 12);
    const rp = rg.attributes.position;
    for (let i = 0; i < rp.count; i++) { const x = rp.getX(i), y = rp.getY(i); rp.setY(i, (y > 0 ? 0 : -3) + (x / L + 0.5) * H); }
    rg.computeVertexNormals();
    const rampa = new THREE.Mesh(rg, M.adobe); rampa.position.set(X1 - L / 2 + 22, PISO, HEROE.z);
    rampa.castShadow = rampa.receiveShadow = true; this.grupo.add(rampa);
    this.rampa = { x0: X1 - L + 22, x1: X1 + 22, H, z: HEROE.z };
    // retícula de bloques en corte (oeste del bloque héroe)
    const geo = new RoundedBoxGeometry(BW, BH, BD, 1, 0.04);
    const celdas = [];
    const rnd = mulberry32(8);
    for (let i = 0; i < 22; i++) for (let j = -12; j <= 12; j++) {
      const x = HEROE.x - i * PASO_X, z = HEROE.z + j * PASO_Z;
      if (i === 0 && j === 0) continue; // héroe
      if (i === 0 && j === -1) continue; // vecino norte ya extraído (esquina libre)
      if (rnd() < 0.12 && i > 2) continue;
      celdas.push([x, z, rnd()]);
    }
    this.reticula = new THREE.InstancedMesh(geo, M.caliza, celdas.length);
    const m4 = new THREE.Matrix4(), c = new THREE.Color();
    celdas.forEach(([x, z, r], k) => {
      const prof = r < 0.25 ? 0.35 : 0; // algunos aún sin canal completo
      m4.makeTranslation(x, PISO + BH / 2 - prof, z); this.reticula.setMatrixAt(k, m4);
      const tt = 0.86 + hash(k) * 0.16; c.setRGB(tt, tt * 0.97, tt * 0.92); this.reticula.setColorAt(k, c);
    });
    this.reticula.castShadow = this.reticula.receiveShadow = true;
    this.grupo.add(this.reticula);
    this.celdas = celdas;
    // otra zona de bloques sueltos listos y trineos cargados en espera
    this.extra = [];
    for (let i = 0; i < 6; i++) {
      const tr = new Trineo({});
      tr.grupo.position.set(HEROE.x + 14 + (i % 3) * 5, PISO, HEROE.z - 14 + Math.floor(i / 3) * 6);
      tr.grupo.rotation.y = Math.PI / 2;
      this.grupo.add(tr.grupo); this.extra.push(tr);
    }
    // bloque héroe, trineo y palancas
    this.heroe = bloque(BW, BH, BD);
    this.grupo.add(this.heroe);
    this.trineo = new Trineo({ conBloque: false });
    this.trineo.grupo.position.set(HEROE.x + 2.9, PISO, HEROE.z);
    this.trineo.grupo.rotation.y = Math.PI / 2; // frente hacia +x (este, la rampa)
    this.grupo.add(this.trineo.grupo);
    this.palancas = [];
    for (let i = 0; i < 2; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.6), M.madera); p.castShadow = true;
      this.grupo.add(p); this.palancas.push(p);
    }
    this.cuerdas = [new Cuerda(0.024), new Cuerda(0.024)];
    for (const c2 of this.cuerdas) this.grupo.add(c2.malla);
    this.esquirlas = new Esquirlas(400);
    this.grupo.add(this.esquirlas.im);
    this.polvo = new Particulas(500, { color: 0xe6d3b4, opacidad: 0.55 });
    this.grupo.add(this.polvo.malla);
    mundo.escena.add(this.grupo);
    this.grupo.visible = false;
  }

  // Reparte cuadrillas por la cantera (corte, palancas, arrastre). Devuelve el índice siguiente.
  cuadrillas(t, multitud, k, { n = 60, velocidad = 1 } = {}) {
    const rnd = mulberry32(99);
    for (let i = 0; i < n; i++) {
      const w = multitud.t(k++); if (!w) break;
      const c = this.celdas[Math.floor(rnd() * this.celdas.length)];
      const tipo = rnd();
      w.visible = true;
      if (tipo < 0.6) {
        w.accion = 'martillar'; w.frec = (1.0 + rnd() * 0.4) * velocidad; w.desfase = rnd();
        w.pos.set(c[0] + (rnd() < 0.5 ? -1 : 1) * 0.3, PISO + BH, c[1] + 0.9); w.yaw = Math.PI + (rnd() - 0.5) * 0.4;
      } else if (tipo < 0.8) {
        w.accion = 'palanca'; w.frec = 0.5 * velocidad; w.desfase = rnd();
        w.pos.set(c[0] - 1.6, PISO, c[1] + 2.4); w.yaw = Math.PI * 0.75;
      } else {
        w.accion = 'parado'; w.vara = rnd() < 0.3;
        w.pos.set(c[0] + 1.2, PISO + BH, c[1] - 0.4); w.yaw = rnd() * 6.28;
      }
    }
    return k;
  }

  // Trineos que suben la rampa de salida con su equipo (fondo)
  arrastres(t, multitud, k, { velocidad = 0.6 } = {}) {
    const r = this.rampa;
    for (let i = 0; i < this.extra.length; i++) {
      const tr = this.extra[i];
      if (i >= 3) continue; // los últimos quedan en espera
      const L = r.x1 - r.x0 + 30;
      const d = ((t * velocidad + i * L / 3) % L);
      const x = r.x0 - 12 + d;
      const y = x < r.x0 ? PISO : x > r.x1 ? PISO + r.H : PISO + (x - r.x0) / (r.x1 - r.x0) * r.H;
      tr.grupo.position.set(x, y, r.z + (i - 1) * 3.2);
      tr.grupo.rotation.set(0, Math.PI / 2, 0);
      const pend = Math.atan2(r.H, r.x1 - r.x0) * (x > r.x0 && x < r.x1 ? 1 : 0);
      tr.grupo.rotateX(-pend);
      for (let j = 0; j < 8; j++) {
        const w = multitud.t(k++); if (!w) return k;
        const xx = x + 3.4 + Math.floor(j / 2) * 1.15;
        const yy = xx < r.x0 ? PISO : xx > r.x1 ? PISO + r.H : PISO + (xx - r.x0) / (r.x1 - r.x0) * r.H;
        w.visible = true; w.accion = 'tirar'; w.ladoCuerda = j % 2 ? -1 : 1;
        w.pos.set(xx, yy, tr.grupo.position.z + (j % 2 ? 0.8 : -0.8)); w.yaw = Math.PI / 2;
        w.fase = xx / 1.0 + w.desfase;
      }
    }
    return k;
  }
}

export { BW, BH, BD, PASO_X, PASO_Z };
