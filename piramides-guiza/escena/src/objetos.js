// Objetos de la obra: bloques de caliza, trineos de madera, cuerdas, palancas,
// embarcaciones del Imperio Antiguo, muelle de piedra y partículas (polvo, esquirlas, agua).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mulberry32, hash, clamp } from './util.js';
import * as TX from './texturas.js';

let _mats = null;
export function materiales() {
  if (_mats) return _mats;
  const cal = TX.texCaliza([210, 188, 150], 21);
  const tura = TX.texCaliza([232, 222, 200], 23);
  const mad = TX.texMadera(3);
  const cue = TX.texCuerda();
  const lino = TX.texLino();
  const adobe = TX.texAdobe(6);
  _mats = {
    caliza: new THREE.MeshStandardMaterial({ map: cal.map, normalMap: cal.normalMap, roughnessMap: cal.roughnessMap, roughness: 1 }),
    tura: new THREE.MeshStandardMaterial({ map: tura.map, normalMap: tura.normalMap, roughness: 0.75 }),
    madera: new THREE.MeshStandardMaterial({ map: mad.map, normalMap: mad.normalMap, roughness: 0.82, color: 0xd8c0a0 }),
    cuerda: new THREE.MeshStandardMaterial({ map: cue.map, normalMap: cue.normalMap, roughness: 0.95 }),
    lino: new THREE.MeshStandardMaterial({ map: lino.map, roughness: 0.92, side: THREE.DoubleSide, color: 0xf2e8d2 }),
    adobe: new THREE.MeshStandardMaterial({ map: adobe.map, normalMap: adobe.normalMap, roughness: 0.97 }),
    casco: new THREE.MeshStandardMaterial({ map: mad.map, normalMap: mad.normalMap, roughness: 0.7, color: 0xc89a6a }),
  };
  _mats.cuerda.map.repeat.set(1, 30); _mats.cuerda.normalMap.repeat.set(1, 30);
  return _mats;
}

export function bloque(w = 1.6, h = 1.0, d = 1.2, mat = null) {
  const g = new RoundedBoxGeometry(w, h, d, 2, 0.06);
  const m = new THREE.Mesh(g, mat || materiales().caliza);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// Trineo de madera: patines curvados, travesaños y bloque amarrado
export class Trineo {
  constructor({ largo = 3.2, ancho = 1.5, conBloque = true, bloqueDim = [1.6, 1.05, 1.25], matBloque = null } = {}) {
    const M = materiales();
    this.grupo = new THREE.Group();
    const perfil = new THREE.Shape();
    perfil.moveTo(-largo / 2, 0); perfil.lineTo(largo / 2 - 0.35, 0);
    perfil.quadraticCurveTo(largo / 2 + 0.05, 0.02, largo / 2 + 0.12, 0.38);
    perfil.lineTo(largo / 2 - 0.08, 0.4); perfil.quadraticCurveTo(largo / 2 - 0.15, 0.2, largo / 2 - 0.4, 0.2);
    perfil.lineTo(-largo / 2, 0.2); perfil.lineTo(-largo / 2, 0);
    const pg = new THREE.ExtrudeGeometry(perfil, { depth: 0.14, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1, curveSegments: 6 });
    pg.rotateY(-Math.PI / 2);
    for (const s of [-1, 1]) {
      const r = new THREE.Mesh(pg, M.madera); r.position.x = s * (ancho / 2 - 0.07) + 0.07; r.castShadow = r.receiveShadow = true;
      this.grupo.add(r);
    }
    const tg = new THREE.BoxGeometry(ancho + 0.12, 0.1, 0.16);
    for (let i = 0; i < 5; i++) {
      const tr = new THREE.Mesh(tg, M.madera); tr.position.set(0, 0.25, -largo / 2 + 0.3 + i * (largo - 0.7) / 4); tr.castShadow = true;
      this.grupo.add(tr);
    }
    this.alturaCarga = 0.3;
    if (conBloque) {
      const [bw, bh, bd] = bloqueDim;
      this.bloque = bloque(bw, bh, bd, matBloque);
      this.bloque.rotation.y = Math.PI / 2;
      this.bloque.position.y = 0.3 + bh / 2;
      this.grupo.add(this.bloque);
      // amarres
      const ag = new THREE.TorusGeometry(1, 0.025, 5, 24);
      for (const z of [-0.45, 0.45]) {
        const a = new THREE.Mesh(ag, M.cuerda); a.scale.set(bd / 2 + 0.03, bh / 2 + 0.03, 1); a.rotation.y = 0;
        a.position.set(0, 0.3 + bh / 2, z); a.rotation.set(0, 0, 0);
        const a2 = a.clone(); a2.rotation.y = Math.PI / 2; a2.position.set(0, 0.3 + bh / 2, z);
        a.castShadow = true; this.grupo.add(a);
        void a2;
      }
    }
    this.largo = largo; this.ancho = ancho;
  }
  // punto de amarre de las cuerdas (frente del trineo), en coordenadas de mundo
  frente(lado = 0) {
    const p = new THREE.Vector3(lado * (this.ancho / 2 - 0.1), 0.32, this.largo / 2 + 0.05);
    return p.applyMatrix4(this.grupo.matrixWorld);
  }
}

// Cuerda: tubo que pasa por una lista de puntos (se reconstruye por cuadro)
export class Cuerda {
  constructor(radio = 0.022) {
    this.radio = radio;
    this.malla = new THREE.Mesh(new THREE.BufferGeometry(), materiales().cuerda);
    this.malla.castShadow = true;
    this.malla.frustumCulled = false;
  }
  actualizar(puntos, combar = 0.15) {
    // insertar comba entre puntos consecutivos
    const pts = [];
    for (let i = 0; i < puntos.length - 1; i++) {
      const a = puntos[i], b = puntos[i + 1];
      pts.push(a.clone());
      const m = a.clone().lerp(b, 0.5); m.y -= combar * a.distanceTo(b) * 0.12;
      pts.push(m);
    }
    pts.push(puntos[puntos.length - 1].clone());
    const curva = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    this.malla.geometry.dispose();
    this.malla.geometry = new THREE.TubeGeometry(curva, Math.max(8, pts.length * 4), this.radio, 5, false);
  }
}

// Embarcación de carga del Imperio Antiguo (casco de tablones con extremos elevados)
export class Barco {
  constructor({ largo = 26, manga = 5.2, puntal = 1.5, remeros = 8, vela = false, carga = 3, seed = 1, matCarga = null } = {}) {
    const M = materiales();
    const rnd = mulberry32(seed);
    this.grupo = new THREE.Group();
    this.largo = largo;
    // casco paramétrico
    const nu = 40, nv = 12;
    const pos = [], idx = [], uv = [];
    for (let i = 0; i <= nu; i++) {
      const u = i / nu, x = (u - 0.5) * largo;
      const fin = Math.abs(2 * u - 1);
      const media = manga / 2 * Math.pow(Math.max(0, 1 - Math.pow(fin, 2.2)), 0.55);
      const sube = Math.pow(fin, 3.2) * 2.6; // proa y popa elevadas
      for (let j = 0; j <= nv; j++) {
        const v = j / nv; // 0 borda izq → 1 borda der
        const a = (v - 0.5) * Math.PI;
        const y = -Math.cos(a) * puntal * (1 - fin * 0.6) + puntal * 0.25 + sube;
        const z = Math.sin(a) * (media + 0.02);
        pos.push(x, y, z); uv.push(u * 6, v * 2);
      }
    }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j, b = a + nv + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const matCasco = M.casco.clone(); matCasco.side = THREE.DoubleSide;
    const casco = new THREE.Mesh(g, matCasco);
    casco.castShadow = casco.receiveShadow = true;
    this.grupo.add(casco);
    // cubierta
    const cub = new THREE.Mesh(new THREE.BoxGeometry(largo * 0.72, 0.12, manga * 0.86), M.madera);
    cub.position.y = puntal * 0.25 + 0.02; cub.receiveShadow = cub.castShadow = true;
    this.grupo.add(cub);
    this.cubierta = puntal * 0.25 + 0.08;
    // remates de proa y popa (papiriformes)
    for (const s of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 1.6, 6), M.casco);
      r.position.set(s * largo * 0.5, puntal * 0.25 + 2.7, 0); r.rotation.z = -s * 0.5; r.castShadow = true;
      this.grupo.add(r);
    }
    // timones de espadilla en popa
    this.timones = [];
    for (const s of [-1, 1]) {
      const t = new THREE.Group();
      const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5.5, 5), M.madera); palo.position.y = -1.5;
      const pala = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 0.55), M.madera); pala.position.y = -3.8;
      t.add(palo, pala);
      t.position.set(-largo * 0.42, puntal * 0.25 + 1.8, s * manga * 0.38); t.rotation.set(s * 0.35, 0, -0.75);
      t.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.grupo.add(t); this.timones.push(t);
    }
    // mástil bípode y vela (si navega a vela, hacia el sur)
    if (vela) {
      const mast = new THREE.Group();
      for (const s of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 11, 6), M.madera);
        p.position.set(0, 5.5, s * 0.9); p.rotation.x = -s * 0.09; p.castShadow = true; mast.add(p);
      }
      const verga = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 9, 5), M.madera);
      verga.rotation.x = Math.PI / 2; verga.position.y = 10.6; mast.add(verga);
      const verga2 = verga.clone(); verga2.position.y = 3.2; mast.add(verga2);
      const vg = new THREE.PlaneGeometry(8.8, 7.2, 10, 8);
      const vp = vg.attributes.position;
      for (let i = 0; i < vp.count; i++) { const x = vp.getX(i) / 4.4, y = vp.getY(i) / 3.6; vp.setZ(i, (1 - x * x) * (1 - y * y * 0.6) * 1.2); }
      vg.computeVertexNormals(); vg.rotateY(Math.PI / 2);
      const v = new THREE.Mesh(vg, M.lino); v.position.y = 6.9; v.castShadow = true; mast.add(v);
      mast.position.set(largo * 0.08, this.cubierta, 0);
      this.grupo.add(mast);
    } else {
      // mástil abatido sobre caballetes
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 11, 6), M.madera);
      p.rotation.z = Math.PI / 2 - 0.08; p.position.set(-1, this.cubierta + 1.6, 0); p.castShadow = true; this.grupo.add(p);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 0.9), M.madera); cab.position.set(-largo * 0.28, this.cubierta + 0.8, 0); this.grupo.add(cab);
    }
    // carga: bloques de caliza fina de Tura
    this.bloques = [];
    for (let i = 0; i < carga; i++) {
      const b = bloque(1.7 + rnd() * 0.3, 1.0 + rnd() * 0.2, 1.3, matCarga || M.tura);
      b.position.set((i - (carga - 1) / 2) * 2.6 + 1.2, this.cubierta + b.geometry.parameters.height / 2, 0);
      b.rotation.y = (rnd() - 0.5) * 0.1;
      this.grupo.add(b); this.bloques.push(b);
    }
    // remos (los remeros los aporta la multitud)
    this.remos = [];
    this.nRemeros = remeros;
    const rg = new THREE.CylinderGeometry(0.035, 0.04, 5.2, 5); rg.translate(0, -2.0, 0);
    const pala = new THREE.BoxGeometry(0.05, 0.9, 0.28); pala.translate(0, -4.3, 0);
    for (let i = 0; i < remeros; i++) for (const s of [-1, 1]) {
      const r = new THREE.Group();
      r.add(new THREE.Mesh(rg, M.madera), new THREE.Mesh(pala, M.madera));
      const x = -largo * 0.3 + (i + 0.5) * (largo * 0.6 / remeros);
      r.position.set(x, this.cubierta + 0.9, s * (manga / 2 - 0.1));
      r.userData = { s, x };
      r.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.grupo.add(r); this.remos.push(r);
    }
  }
  // animación de remos (fase 0..1)
  remar(f) {
    for (const r of this.remos) {
      const s = r.userData.s;
      const a = Math.sin(f * Math.PI * 2);
      const prof = Math.max(0, Math.cos(f * Math.PI * 2));
      r.rotation.set(s * (0.95 - prof * 0.28), 0, a * 0.5);
    }
  }
  // posiciones de remeros (local) para la multitud
  puestosRemeros() {
    const out = [];
    for (const r of this.remos) out.push({ pos: new THREE.Vector3(r.userData.x - 0.5, this.cubierta, r.userData.s * 1.25), lado: r.userData.s });
    return out;
  }
}

// Muelle de piedra (bloques) a lo largo de una línea
export function muelle(desde, hasta, alto = 3.2) {
  const M = materiales();
  const L = desde.distanceTo(hasta);
  const n = Math.ceil(L / 1.8);
  const geo = new RoundedBoxGeometry(1.75, 0.95, 1.4, 1, 0.05);
  const filas = Math.ceil(alto / 1.0);
  const im = new THREE.InstancedMesh(geo, M.caliza, n * filas * 2);
  const dir = new THREE.Vector3().subVectors(hasta, desde).normalize();
  const yaw = Math.atan2(dir.x, dir.z) + Math.PI / 2;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const nrm = new THREE.Vector3(dir.z, 0, -dir.x);
  let k = 0;
  const c = new THREE.Color();
  for (let f = 0; f < filas; f++) for (let i = 0; i < n; i++) for (let p = 0; p < 2; p++) {
    const off = (f % 2) * 0.9;
    const pt = desde.clone().addScaledVector(dir, i * 1.8 + off).addScaledVector(nrm, p * 1.45);
    pt.y = desde.y + f * 1.0 + 0.47;
    m4.compose(pt, q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(k, m4);
    const t = 0.85 + hash(k) * 0.18; c.setRGB(t, t * 0.96, t * 0.9); im.setColorAt(k, c);
    k++;
  }
  im.castShadow = im.receiveShadow = true;
  return im;
}

// ---------- Partículas ----------
const vsPart = `
  attribute float aAlfa; attribute float aTam; attribute vec3 aCentro; attribute float aGiro;
  varying float vAlfa; varying vec2 vUv;
  #include <fog_pars_vertex>
  void main(){
    vUv = uv; vAlfa = aAlfa;
    vec4 mv = modelViewMatrix * vec4(aCentro, 1.0);
    float c = cos(aGiro), s = sin(aGiro);
    vec2 p = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * aTam;
    mv.xy += p;
    gl_Position = projectionMatrix * mv;
    vec4 mvPosition = mv;
    #include <fog_vertex>
  }`;
const fsPart = `
  uniform sampler2D mapa; uniform vec3 color; uniform float opacidad;
  varying float vAlfa; varying vec2 vUv;
  #include <fog_pars_fragment>
  void main(){
    vec4 t = texture2D(mapa, vUv);
    gl_FragColor = vec4(color * t.rgb, t.a * vAlfa * opacidad);
    #include <fog_fragment>
  }`;

export class Particulas {
  constructor(max = 400, { color = 0xd8bf98, opacidad = 0.5, aditivo = false } = {}) {
    const q = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = q.index; g.attributes.position = q.attributes.position; g.attributes.uv = q.attributes.uv;
    this.aCentro = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.aAlfa = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.aTam = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.aGiro = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    for (const [n, a] of [['aCentro', this.aCentro], ['aAlfa', this.aAlfa], ['aTam', this.aTam], ['aGiro', this.aGiro]]) { a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(n, a); }
    g.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { mapa: { value: TX.texPolvo() }, color: { value: new THREE.Color(color) }, opacidad: { value: opacidad } }]),
      vertexShader: vsPart, fragmentShader: fsPart, transparent: true, depthWrite: false, fog: true,
      blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.malla = new THREE.Mesh(g, this.mat);
    this.malla.frustumCulled = false;
    this.malla.renderOrder = 10;
    this.max = max; this.n = 0;
  }
  iniciar() { this.n = 0; }
  agregar(p, tam, alfa, giro = 0) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.aCentro.setXYZ(i, p.x, p.y, p.z); this.aTam.setX(i, tam); this.aAlfa.setX(i, alfa); this.aGiro.setX(i, giro);
  }
  cerrar() {
    this.malla.geometry.instanceCount = this.n;
    for (const a of [this.aCentro, this.aAlfa, this.aTam, this.aGiro]) a.needsUpdate = true;
  }
}

// Nube de polvo sin estado: emisor en p0, partículas nacidas a ritmo 'tasa' (por s)
export function emitirPolvo(part, t, p0, { tasa = 10, vida = 2.5, seed = 1, viento = new THREE.Vector3(0.6, 0.25, 0.1), tam0 = 0.4, tam1 = 2.2, alfa = 0.35, dispersion = 0.6, desde = -1e9 } = {}) {
  const n = Math.ceil(vida * tasa);
  const k0 = Math.floor(t * tasa);
  for (let k = k0 - n; k <= k0; k++) {
    const tn = k / tasa;
    if (tn < desde) continue;
    const e = t - tn;
    if (e < 0 || e > vida) continue;
    const f = e / vida;
    const h1 = hash(k * 7 + seed * 131), h2 = hash(k * 13 + seed * 71), h3 = hash(k * 19 + seed * 37);
    const p = new THREE.Vector3(p0.x + (h1 - 0.5) * dispersion + viento.x * e, p0.y + viento.y * e + h3 * 0.2, p0.z + (h2 - 0.5) * dispersion + viento.z * e);
    part.agregar(p, tam0 + (tam1 - tam0) * Math.sqrt(f), alfa * Math.sin(Math.PI * Math.min(1, f * 1.3)) * (0.6 + h3 * 0.4), h1 * 6.28 + e * 0.3);
  }
}

// Esquirlas de piedra (malla instanciada) con balística determinista
export class Esquirlas {
  constructor(max = 300) {
    const g = new THREE.DodecahedronGeometry(0.025, 0);
    this.im = new THREE.InstancedMesh(g, materiales().caliza, max);
    this.im.castShadow = true; this.im.frustumCulled = false; this.im.count = 0;
    this.max = max; this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler();
  }
  iniciar() { this.n = 0; }
  // golpe en p0 al tiempo tg: emite 'cant' esquirlas
  golpe(t, tg, p0, cant = 10, seed = 1, suelo = p0.y - 0.3) {
    const e = t - tg;
    if (e < 0 || e > 1.4) return;
    for (let k = 0; k < cant; k++) {
      if (this.n >= this.max) return;
      const h1 = hash(seed * 977 + k * 3), h2 = hash(seed * 577 + k * 5), h3 = hash(seed * 311 + k * 7);
      const v = new THREE.Vector3((h1 - 0.5) * 2.4, 1.2 + h2 * 2.0, (h3 - 0.5) * 2.4);
      const p = p0.clone().addScaledVector(v, e); p.y -= 4.9 * e * e;
      if (p.y < suelo) p.y = suelo;
      const s = 0.4 + h2 * 1.4;
      this._e.set(e * 10 * h1, e * 8 * h2, 0); this._q.setFromEuler(this._e);
      this._m.compose(p, this._q, new THREE.Vector3(s, s * 0.7, s));
      this.im.setMatrixAt(this.n++, this._m);
    }
  }
  cerrar() { this.im.count = this.n; this.im.instanceMatrix.needsUpdate = true; }
}

// Mancha de arena húmeda (calcomanía) sobre el suelo
let _texHumeda = null;
export function manchaHumeda() {
  if (!_texHumeda) {
    const t = TX.texArena(false);
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 20, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.6, 'rgba(255,255,255,0.8)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    const alfa = new THREE.CanvasTexture(c);
    _texHumeda = { ...t, alfa };
  }
  const mat = new THREE.MeshStandardMaterial({ map: _texHumeda.map, normalMap: _texHumeda.normalMap, alphaMap: _texHumeda.alfa,
    transparent: true, roughness: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  return mat;
}

export const clampV = clamp;
