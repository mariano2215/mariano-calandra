// Multitud de trabajadores articulados (cinemática directa) con instanciado por parte del cuerpo.
// Acciones: caminar, tirar (cuerda al hombro, como en la tumba de Dyehutihotep), martillar
// (cincel de cobre + mazo de madera), verter (jarra de agua), palanca, empujar, remar, parado, cargar.
import * as THREE from 'three';
import { mulberry32, clamp } from './util.js';
import * as TX from './texturas.js';

const TAU = Math.PI * 2;

function lathe(perfil, seg = 8) {
  const pts = perfil.map(([r, y]) => new THREE.Vector2(Math.max(0.001, r), y));
  const g = new THREE.LatheGeometry(pts, seg);
  g.computeVertexNormals();
  return g;
}

// Geometrías de las partes (origen en la articulación proximal; los miembros cuelgan hacia -y)
function geometrias() {
  const G = {};
  // torso desde la cintura (y=0) hasta la base del cuello (y=0.50)
  G.torso = lathe([[0.0, -0.02], [0.135, 0.0], [0.13, 0.08], [0.125, 0.16], [0.14, 0.26], [0.165, 0.36], [0.17, 0.42], [0.14, 0.48], [0.06, 0.52], [0.0, 0.53]], 10);
  G.torso.scale(1.18, 1, 0.74);
  // pecho/espalda: leve desplazamiento para dar volumen pectoral
  {
    const p = G.torso.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), z = p.getZ(i); if (z > 0 && y > 0.25 && y < 0.45) p.setZ(i, z * 1.12); }
    G.torso.computeVertexNormals();
  }
  G.cuello = lathe([[0.05, 0], [0.048, 0.07], [0.0, 0.08]], 6);
  // cabeza: esfera alargada con mandíbula
  G.cabeza = new THREE.SphereGeometry(0.105, 12, 10);
  {
    const p = G.cabeza.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      y *= 1.12; x *= 0.9;
      if (y < -0.02) { x *= 0.85 + (y + 0.12) * 1.2; z *= 0.95; } // mandíbula
      if (z > 0.06 && Math.abs(x) < 0.025 && y > -0.03 && y < 0.03) z += 0.018; // nariz
      p.setXYZ(i, x, y + 0.11, z + 0.01);
    }
    G.cabeza.computeVertexNormals();
  }
  // cabello corto / paño de cabeza
  G.pelo = new THREE.SphereGeometry(0.112, 12, 8, 0, TAU, 0, Math.PI * 0.55);
  {
    const p = G.pelo.attributes.position;
    for (let i = 0; i < p.count; i++) { p.setXYZ(i, p.getX(i) * 0.93, p.getY(i) * 1.1 + 0.125, p.getZ(i) - 0.008); }
    G.pelo.computeVertexNormals();
  }
  // faldellín de lino (shendyt): de la cintura (y=0) hacia abajo
  G.falda = lathe([[0.0, 0.03], [0.15, 0.03], [0.16, 0.0], [0.18, -0.12], [0.21, -0.26], [0.235, -0.36], [0.0, -0.36]], 12);
  G.falda.scale(1.12, 1, 0.86);
  G.brazo = lathe([[0.0, 0.02], [0.05, 0.0], [0.055, -0.06], [0.05, -0.16], [0.04, -0.27], [0.036, -0.30], [0.0, -0.31]], 7);
  G.antebrazo = lathe([[0.0, 0.01], [0.038, 0.0], [0.042, -0.06], [0.032, -0.2], [0.026, -0.25], [0.03, -0.27], [0.042, -0.31], [0.044, -0.36], [0.034, -0.41], [0.018, -0.44], [0.0, -0.445]], 8);
  G.muslo = lathe([[0.0, 0.03], [0.075, 0.0], [0.08, -0.08], [0.068, -0.25], [0.05, -0.42], [0.0, -0.45]], 8);
  G.pierna = lathe([[0.0, 0.02], [0.05, 0.0], [0.055, -0.1], [0.042, -0.25], [0.03, -0.4], [0.0, -0.43]], 7);
  G.pie = new THREE.BoxGeometry(0.085, 0.055, 0.24); G.pie.translate(0, -0.028, 0.06);
  // herramientas
  G.mazo = new THREE.CylinderGeometry(0.055, 0.075, 0.24, 8); G.mazo.translate(0, -0.18, 0);
  {
    const mango = new THREE.CylinderGeometry(0.018, 0.02, 0.2, 6); mango.translate(0, -0.02, 0);
    G.mazo = mergeSimple([G.mazo, mango]);
  }
  G.cincel = new THREE.CylinderGeometry(0.012, 0.016, 0.24, 6); G.cincel.translate(0, -0.1, 0);
  G.jarra = lathe([[0.0, 0], [0.09, 0.02], [0.13, 0.12], [0.12, 0.22], [0.07, 0.3], [0.055, 0.34], [0.065, 0.36], [0.0, 0.36]], 10);
  G.vara = new THREE.CylinderGeometry(0.015, 0.018, 1.6, 5); G.vara.translate(0, -0.3, 0);
  G.cesto = lathe([[0.0, 0], [0.18, 0.01], [0.24, 0.1], [0.25, 0.12], [0.0, 0.12]], 10);
  return G;
}

function mergeSimple(geos) {
  const pos = [], nor = [];
  for (const g0 of geos) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

// Pose base
function poseNeutra() {
  return {
    bajar: 0, bob: 0, inclinar: 0, ladear: 0, girarTorso: 0, cabeza: 0, cabezaGiro: 0,
    cadera: [0, 0], abdCadera: [0.04, 0.04], rodilla: [0.05, 0.05], tobillo: [0, 0],
    hombro: [0.05, 0.05], abd: [0.12, 0.12], codo: [0.15, 0.15], giroBrazo: [0, 0],
    mazo: 0, cincel: 0, jarra: 0, vara: 0, cesto: 0, inclJarra: 0,
  };
}

// Ciclo de marcha (fase en ciclos)
function marcha(p, fase, amp = 1, pesado = 0) {
  const s = Math.sin(fase * TAU), c = Math.cos(fase * TAU);
  for (let k = 0; k < 2; k++) {
    const sg = k === 0 ? 1 : -1, ph = fase * TAU + (k === 0 ? 0 : Math.PI);
    const sh = Math.sin(ph);
    p.cadera[k] = sh * 0.42 * amp + pesado * 0.25;
    // rodilla: flexión en balanceo (cuando la pierna avanza) y leve en apoyo
    const bal = Math.max(0, Math.sin(ph + 1.2));
    p.rodilla[k] = 0.1 + bal * 0.95 * amp + pesado * 0.25;
    p.tobillo[k] = -Math.sin(ph + 0.6) * 0.2 * amp;
    p.hombro[k] = -sh * 0.38 * amp;
    p.codo[k] = 0.25 + Math.max(0, -sh) * 0.3 * amp;
    void sg;
  }
  p.bob = -Math.abs(c) * 0.035 * amp + 0.015;
  p.ladear = s * 0.03 * amp;
  p.girarTorso = s * 0.08 * amp;
}

export const ACCIONES = {
  parado(p, w, t) {
    const r = Math.sin(t * 1.3 + w.semilla * 10);
    p.inclinar = 0.02 + r * 0.01; p.cabeza = 0.05 + Math.sin(t * 0.4 + w.semilla * 7) * 0.08;
    p.cabezaGiro = Math.sin(t * 0.3 + w.semilla * 3) * 0.3;
    p.abd = [0.14, 0.16]; p.codo = [0.35 + r * 0.03, 0.42]; p.hombro = [0.12, -0.05];
    p.cadera = [0.06, -0.04]; p.rodilla = [0.12, 0.04]; p.ladear = 0.04; p.abdCadera = [0.08, 0.02];
    if (w.vara) { p.vara = 1; p.hombro[1] = 0.35; p.codo[1] = 1.2; p.abd[1] = 0.2; }
  },
  caminar(p, w) {
    marcha(p, w.fase, w.amp ?? 1);
    p.inclinar = 0.05; p.cabeza = 0.05;
    if (w.vara) { p.vara = 1; p.hombro[1] = 0.35; p.codo[1] = 1.2; }
  },
  cargar(p, w) { // cesto sobre la cabeza
    marcha(p, w.fase, 0.75);
    p.inclinar = 0.0; p.cabeza = -0.05;
    p.hombro[0] = 2.75; p.codo[0] = 0.5; p.abd[0] = 0.35; p.cesto = 1;
  },
  tirar(p, w) { // cuerda sobre el hombro, cuerpo inclinado hacia adelante
    marcha(p, w.fase, 0.6, 0.5);
    p.inclinar = 0.55 + Math.sin(w.fase * TAU * 2) * 0.04;
    p.bajar = 0.1;
    p.cabeza = -0.35;
    p.hombro = [1.0, 0.25]; p.codo = [1.9, 1.0]; p.abd = [-0.1, 0.25]; // mano adelantada sobre el hombro / mano atrás
    if (w.ladoCuerda < 0) { p.hombro = [0.25, 1.0]; p.codo = [1.0, 1.9]; p.abd = [0.25, -0.1]; }
  },
  tirarAtras(p, w) { // tirar de frente, inclinado hacia atrás (equipos cortos)
    marcha(p, w.fase, 0.45, 0.3);
    p.inclinar = -0.3; p.bajar = 0.12; p.cabeza = 0.2;
    p.hombro = [1.25, 1.2]; p.codo = [0.35, 0.4]; p.abd = [-0.05, -0.05];
  },
  empujar(p, w) {
    marcha(p, w.fase, 0.55, 0.6);
    p.inclinar = 0.75; p.bajar = 0.15; p.cabeza = -0.5;
    p.hombro = [1.55, 1.5]; p.codo = [0.6, 0.6]; p.abd = [0.1, 0.1];
  },
  martillar(p, w, t) { // arrodillado: cincel en mano izquierda, mazo en mano derecha
    const f = ((t * w.frec + w.desfase) % 1 + 1) % 1;
    // subida lenta, bajada rápida, impacto en f≈0.82
    let sube = f < 0.62 ? f / 0.62 : f < 0.82 ? 1 - (f - 0.62) / 0.2 : 0;
    sube = sube * sube * (3 - 2 * sube);
    p.bajar = 0.42; p.inclinar = 0.42 + sube * 0.08;
    p.cadera = [1.45, 0.25]; p.rodilla = [1.55, 1.95]; p.tobillo = [0.1, 0.7];
    p.abdCadera = [0.15, 0.12];
    p.cabeza = 0.35;
    p.hombro[0] = 0.85; p.codo[0] = 0.55; p.abd[0] = -0.12; p.cincel = 1;
    p.hombro[1] = 0.65 + sube * 1.75; p.codo[1] = 0.45 + sube * 0.9; p.abd[1] = 0.05 - sube * 0.05; p.mazo = 1;
    p.golpe = f;
  },
  palanca(p, w, t) { // empujando hacia abajo el extremo de una palanca
    const f = Math.sin((t * (w.frec || 0.5) + w.desfase) * TAU) * 0.5 + 0.5;
    p.inclinar = 0.45 + f * 0.35; p.bajar = 0.05 + f * 0.12;
    p.cadera = [0.35 + f * 0.3, -0.15 + f * 0.2]; p.rodilla = [0.3 + f * 0.4, 0.15 + f * 0.25];
    p.hombro = [1.35 - f * 0.6, 1.3 - f * 0.6]; p.codo = [0.3, 0.3]; p.abd = [-0.05, -0.05];
    p.cabeza = -0.2;
    p.fuerza = f;
  },
  verter(p, w, t) { // camina lentamente vertiendo agua delante del trineo
    marcha(p, w.fase, 0.45);
    p.inclinar = 0.28; p.cabeza = 0.45;
    p.hombro = [0.95, 0.95]; p.codo = [0.85, 0.85]; p.abd = [-0.2, -0.2];
    p.jarra = 1; p.inclJarra = 0.95 + Math.sin(t * 2 + w.semilla * 5) * 0.08;
  },
  remar(p, w, t) {
    const f = ((t * (w.frec || 0.5) + w.desfase) % 1 + 1) % 1;
    const s = Math.sin(f * TAU);
    p.bajar = 0.45; p.cadera = [1.5, 1.5]; p.rodilla = [1.5, 1.5]; p.tobillo = [0.1, 0.1];
    p.inclinar = 0.15 + s * 0.35; p.cabeza = -0.1 - s * 0.2;
    p.hombro = [1.1 + s * 0.5, 1.1 + s * 0.5]; p.codo = [0.4 - s * 0.3, 0.4 - s * 0.3]; p.abd = [-0.15, -0.15];
    p.remo = f;
  },
  sentado(p, w, t) {
    p.bajar = 0.5; p.cadera = [1.45, 1.45]; p.rodilla = [1.5, 1.5];
    p.inclinar = 0.2; p.cabeza = 0.1 + Math.sin(t * 0.5 + w.semilla) * 0.1;
    p.hombro = [0.6, 0.6]; p.codo = [0.9, 0.9];
  },
};

export class Multitud {
  constructor(max = 600) {
    this.max = max;
    const G = geometrias();
    const lino = TX.texLino();
    lino.map.repeat.set(3, 3);
    this.mats = {
      piel: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0.0 }),
      lino: new THREE.MeshStandardMaterial({ color: 0xffffff, map: lino.map, roughness: 0.9 }),
      pelo: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }),
      cobre: new THREE.MeshStandardMaterial({ color: 0xb06a3a, roughness: 0.38, metalness: 0.85 }),
      madera: new THREE.MeshStandardMaterial({ color: 0x7a5534, roughness: 0.85 }),
      ceramica: new THREE.MeshStandardMaterial({ color: 0xa4593a, roughness: 0.8 }),
      cesto: new THREE.MeshStandardMaterial({ color: 0xa88a52, roughness: 0.95 }),
    };
    const mk = (geo, mat, n, color = false) => {
      const im = new THREE.InstancedMesh(geo, mat, n);
      im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (color) im.setColorAt(0, new THREE.Color(1, 1, 1));
      im.count = 0;
      return im;
    };
    this.partes = {
      torso: mk(G.torso, this.mats.piel, max, true),
      cuello: mk(G.cuello, this.mats.piel, max, true),
      cabeza: mk(G.cabeza, this.mats.piel, max, true),
      pelo: mk(G.pelo, this.mats.pelo, max, true),
      falda: mk(G.falda, this.mats.lino, max, true),
      brazo: mk(G.brazo, this.mats.piel, max * 2, true),
      antebrazo: mk(G.antebrazo, this.mats.piel, max * 2, true),
      muslo: mk(G.muslo, this.mats.piel, max * 2, true),
      pierna: mk(G.pierna, this.mats.piel, max * 2, true),
      pie: mk(G.pie, this.mats.piel, max * 2, true),
      mazo: mk(G.mazo, this.mats.madera, max),
      cincel: mk(G.cincel, this.mats.cobre, max),
      jarra: mk(G.jarra, this.mats.ceramica, max),
      vara: mk(G.vara, this.mats.madera, max),
      cesto: mk(G.cesto, this.mats.cesto, max),
    };
    this.grupo = new THREE.Group();
    for (const k in this.partes) this.grupo.add(this.partes[k]);
    this.trab = [];
    const rnd = mulberry32(1234);
    for (let i = 0; i < max; i++) {
      const piel = new THREE.Color().setHSL(0.055 + rnd() * 0.025, 0.42 + rnd() * 0.15, 0.27 + rnd() * 0.13);
      const lin = new THREE.Color().setHSL(0.11, 0.25 + rnd() * 0.15, 0.78 + rnd() * 0.12);
      const pelo = rnd() < 0.25 ? new THREE.Color().setHSL(0.1, 0.2, 0.82) : new THREE.Color().setHSL(0.06, 0.3, 0.06 + rnd() * 0.05);
      this.trab.push({ i, semilla: rnd(), escala: 0.93 + rnd() * 0.12, piel, lin, pelo, accion: 'parado',
        pos: new THREE.Vector3(), yaw: 0, fase: rnd(), frec: 1.0 + rnd() * 0.3, desfase: rnd(), ladoCuerda: rnd() < 0.5 ? 1 : -1,
        visible: false, manos: [new THREE.Vector3(), new THREE.Vector3()], hombros: [new THREE.Vector3(), new THREE.Vector3()] });
    }
    // colores fijos
    for (const w of this.trab) {
      for (const k of ['torso', 'cuello', 'cabeza']) this.partes[k].setColorAt(w.i, w.piel);
      for (const k of ['brazo', 'antebrazo', 'muslo', 'pierna', 'pie']) { this.partes[k].setColorAt(w.i * 2, w.piel); this.partes[k].setColorAt(w.i * 2 + 1, w.piel); }
      this.partes.falda.setColorAt(w.i, w.lin);
      this.partes.pelo.setColorAt(w.i, w.pelo);
    }
    for (const k in this.partes) if (this.partes[k].instanceColor) this.partes[k].instanceColor.needsUpdate = true;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler();
    this.activos = 0;
  }

  // Devuelve trabajador i (para configurar en cada cuadro)
  t(i) { return this.trab[i]; }

  ocultarTodos() { for (const w of this.trab) w.visible = false; }

  actualizar(t) {
    const P = this.partes;
    const M = THREE.Matrix4;
    const cero = new M().makeScale(0, 0, 0);
    let n = 0;
    for (const w of this.trab) if (w.visible) n = w.i + 1;
    for (const k in P) P[k].count = (k === 'brazo' || k === 'antebrazo' || k === 'muslo' || k === 'pierna' || k === 'pie') ? n * 2 : n;
    const rx = (a) => new M().makeRotationX(a), ry = (a) => new M().makeRotationY(a), rz = (a) => new M().makeRotationZ(a);
    const tr = (x, y, z) => new M().makeTranslation(x, y, z);
    for (let idx = 0; idx < n; idx++) {
      const w = this.trab[idx];
      if (!w.visible) {
        for (const k in P) {
          if (P[k].count > n) { P[k].setMatrixAt(idx * 2, cero); P[k].setMatrixAt(idx * 2 + 1, cero); } else P[k].setMatrixAt(idx, cero);
        }
        continue;
      }
      const p = poseNeutra();
      (ACCIONES[w.accion] || ACCIONES.parado)(p, w, t);
      w.pose = p;
      const s = w.escala;
      const raiz = tr(w.pos.x, w.pos.y, w.pos.z).multiply(ry(w.yaw)).multiply(new M().makeScale(s, s, s));
      const pelvis = raiz.clone().multiply(tr(0, 0.93 - p.bajar + p.bob, 0)).multiply(rz(p.ladear * 0.5));
      const torso = pelvis.clone().multiply(tr(0, 0.04, 0)).multiply(rx(p.inclinar)).multiply(ry(p.girarTorso)).multiply(rz(p.ladear));
      P.torso.setMatrixAt(idx, torso);
      P.falda.setMatrixAt(idx, pelvis.clone().multiply(tr(0, 0.07, 0)).multiply(rx(Math.max(0, (p.cadera[0] + p.cadera[1]) * 0.25))));
      const cuello = torso.clone().multiply(tr(0, 0.49, 0.0));
      P.cuello.setMatrixAt(idx, cuello);
      const cabeza = cuello.clone().multiply(tr(0, 0.06, 0.01)).multiply(ry(p.cabezaGiro)).multiply(rx(p.cabeza));
      P.cabeza.setMatrixAt(idx, cabeza);
      P.pelo.setMatrixAt(idx, cabeza);
      // brazos
      for (let k = 0; k < 2; k++) {
        const sg = k === 0 ? -1 : 1; // k=0 izquierda (-x), k=1 derecha (+x)
        const hombro = torso.clone().multiply(tr(sg * 0.2, 0.43, 0)).multiply(rz(sg * p.abd[k])).multiply(rx(-p.hombro[k])).multiply(ry(p.giroBrazo[k]));
        P.brazo.setMatrixAt(idx * 2 + k, hombro);
        const codo = hombro.clone().multiply(tr(0, -0.29, 0)).multiply(rx(-p.codo[k]));
        P.antebrazo.setMatrixAt(idx * 2 + k, codo);
        const mano = codo.clone().multiply(tr(0, -0.35, 0.0));
        w.manos[k].setFromMatrixPosition(mano);
        w.hombros[k].setFromMatrixPosition(torso.clone().multiply(tr(sg * 0.17, 0.5, 0.02)));
        if (k === 1) {
          P.mazo.setMatrixAt(idx, p.mazo ? mano.clone().multiply(rx(-1.35)) : cero);
          P.vara.setMatrixAt(idx, p.vara ? mano.clone().multiply(rx(-0.9)) : cero);
        } else {
          P.cincel.setMatrixAt(idx, p.cincel ? mano.clone().multiply(rx(0.25)) : cero);
          w.puntaCincel = p.cincel ? new THREE.Vector3(0, -0.22, 0).applyMatrix4(mano.clone().multiply(rx(0.25))) : null;
          P.cesto.setMatrixAt(idx, p.cesto ? cabeza.clone().multiply(tr(0, 0.23, 0)) : cero);
        }
      }
      // jarra sostenida con ambas manos
      if (p.jarra) {
        const centro = w.manos[0].clone().add(w.manos[1]).multiplyScalar(0.5);
        const mj = tr(centro.x, centro.y - 0.12 * s, centro.z).multiply(ry(w.yaw)).multiply(rx(p.inclJarra)).multiply(new M().makeScale(s, s, s));
        P.jarra.setMatrixAt(idx, mj);
        w.bocaJarra = new THREE.Vector3(0, 0.36, 0).applyMatrix4(mj);
      } else P.jarra.setMatrixAt(idx, cero);
      // piernas
      for (let k = 0; k < 2; k++) {
        const sg = k === 0 ? -1 : 1;
        const cadera = pelvis.clone().multiply(tr(sg * 0.095, 0, 0)).multiply(rz(sg * p.abdCadera[k])).multiply(rx(-p.cadera[k]));
        P.muslo.setMatrixAt(idx * 2 + k, cadera);
        const rodilla = cadera.clone().multiply(tr(0, -0.44, 0)).multiply(rx(p.rodilla[k]));
        P.pierna.setMatrixAt(idx * 2 + k, rodilla);
        const tobillo = rodilla.clone().multiply(tr(0, -0.42, 0)).multiply(rx(-p.rodilla[k] + p.cadera[k] + p.tobillo[k] - p.inclinar * 0));
        P.pie.setMatrixAt(idx * 2 + k, tobillo);
      }
    }
    for (const k in P) P[k].instanceMatrix.needsUpdate = true;
  }
}

// Ayuda: coloca a un trabajador caminando por una trayectoria (función f(d) → {pos, yaw})
export function caminarPor(w, d, ruta, zancada = 1.45) {
  const r = ruta(d);
  w.pos.copy(r.pos); w.yaw = r.yaw;
  w.fase = d / (zancada * w.escala);
}
