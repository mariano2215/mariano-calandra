// Mundo compartido por todas las escenas: cielo, sol, niebla, terreno de la meseta,
// valle del Nilo (campos, río, canal y puerto), palmeras y ciudad actual.
// Coordenadas: Gran Pirámide en el origen; norte = -z, este = +x; 1 unidad = 1 m.
import * as THREE from 'three';
import { fbm2, mulberry32, clamp, smooth } from './util.js';
import * as TX from './texturas.js';

export const NIVEL_VALLE = -24;
export const CANTERA = { x: 70, z: 400, ancho: 150, largo: 110, prof: 11 };
export const PUERTO = { x: 720, z: -60, ancho: 260, largo: 520 }; // x 590–850, z −320–200
export const XQ = 594; // muelle (borde oeste del puerto)
export const AGUA = NIVEL_VALLE + 0.5;

export function esAgua(x, z, margen = 0) {
  const m = margen;
  if (x > XQ - 0.5 - m && x < 860 + m && Math.abs(z - PUERTO.z) < PUERTO.largo / 2 + m) return true;
  if (x >= 840 - m && x < 1760 + m && Math.abs(z + 60) < 46 + m) return true;
  if (x >= 1750 - m && x < 2450 + m) return true;
  return false;
}

// Altura del terreno (función global, reutilizada por objetos para apoyarse en el suelo)
export function alturaTerreno(x, z) {
  // meseta con leve relieve
  let h = fbm2(x * 0.0016, z * 0.0016, 4) * 6 + fbm2(x * 0.012, z * 0.012, 3) * 0.6;
  // explanada nivelada alrededor de la pirámide
  const dP = Math.max(Math.abs(x), Math.abs(z));
  const nivel = smooth(clamp((dP - 150) / 260));
  h *= nivel;
  // caída hacia el valle al este
  const bajada = smooth(clamp((x - 420) / 220));
  h = h * (1 - bajada) + NIVEL_VALLE * bajada;
  // dunas al oeste y sur-oeste
  const oeste = smooth(clamp((-x - 500) / 900));
  h += oeste * (fbm2(x * 0.004, z * 0.004, 4) * 18 + 14);
  // colinas lejanas al este del Nilo
  const colinas = smooth(clamp((x - 3600) / 1200));
  h += colinas * (60 + fbm2(x * 0.002, z * 0.003, 4) * 40);
  // hoyo de la cantera
  const qx = Math.abs(x - CANTERA.x) - CANTERA.ancho / 2, qz = Math.abs(z - CANTERA.z) - CANTERA.largo / 2;
  const dq = Math.max(qx, qz);
  if (dq < 4) h = Math.min(h, -CANTERA.prof);
  // puerto, canal y río
  if (x > XQ - 0.5 && x < 860 && Math.abs(z - PUERTO.z) < PUERTO.largo / 2) h = Math.min(h, AGUA - 2.5);
  if (x >= 840 && x < 1760 && Math.abs(z + 60) < 46) h = Math.min(h, AGUA - 2.5);
  if (x >= 1750 && x < 2450) h = Math.min(h, AGUA - 3);
  return h;
}

export class Mundo {
  constructor(renderer) {
    this.renderer = renderer;
    this.escena = new THREE.Scene();
    this.escena.fog = new THREE.FogExp2(0xd9c3a0, 0.00022);
    this.grupos = {};
    this._cielo();
    this._luces();
    this._terreno();
    this._valle();
    this._palmeras();
    this._ciudad();
  }

  _cielo() {
    // Cielo procedural propio: gradiente cenit/horizonte, halo y disco solar, nubes altas tenues
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        cenit: { value: new THREE.Color() }, horizonte: { value: new THREE.Color() }, bajo: { value: new THREE.Color() },
        solDir: { value: new THREE.Vector3(0, 1, 0) }, solColor: { value: new THREE.Color() },
        halo: { value: 1.0 }, disco: { value: 30.0 }, nubes: { value: 0.35 }, brillo: { value: 1.0 },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: `
        uniform vec3 cenit, horizonte, bajo, solDir, solColor; uniform float halo, disco, nubes, brillo;
        varying vec3 vDir;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * n(p); p *= 2.03; a *= 0.5; } return s; }
        void main(){
          vec3 d = normalize(vDir);
          float y = d.y;
          float t = pow(clamp(y, 0.0, 1.0), 0.32);
          vec3 c = mix(horizonte, cenit, t);
          c = mix(c, bajo, smoothstep(0.0, -0.08, y));
          float mu = max(dot(d, solDir), 0.0);
          // halo de Mie alrededor del sol y resplandor del horizonte en su dirección
          c += solColor * (pow(mu, 8.0) * 0.35 + pow(mu, 64.0) * 0.8) * halo;
          c += solColor * pow(mu, 2.0) * 0.12 * halo * (1.0 - t);
          // nubes altas (cirros) proyectadas sobre un plano
          if (y > 0.02) {
            vec2 uv = d.xz / (y + 0.08) * 1.2;
            float nb = smoothstep(0.52, 0.85, fbm(uv * 1.3 + vec2(3.0, 1.0))) * nubes * smoothstep(0.02, 0.25, y);
            vec3 cn = mix(horizonte * 1.15, solColor * 0.9 + horizonte * 0.4, pow(mu, 4.0));
            c = mix(c, cn, nb * 0.6);
          }
          // disco solar
          c += solColor * smoothstep(0.99985 - 0.00002 * disco, 0.99995, mu) * 40.0;
          gl_FragColor = vec4(c * brillo, 1.0);
        }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(15000, 48, 24), mat);
    sky.frustumCulled = false;
    sky.renderOrder = -1;
    this.cielo = sky;
    this.escena.add(sky);
    this.solDir = new THREE.Vector3(0, 1, 0);
  }

  _luces() {
    const sol = new THREE.DirectionalLight(0xffe2b8, 3.2);
    sol.castShadow = true;
    sol.shadow.mapSize.set(4096, 4096);
    sol.shadow.bias = -0.0004;
    sol.shadow.normalBias = 0.6;
    this.escena.add(sol, sol.target);
    this.sol = sol;
    this.hemi = new THREE.HemisphereLight(0xbfd4ef, 0xb08a60, 0.9);
    this.escena.add(this.hemi);
  }

  // Ajusta la sombra para encuadrar una zona (centro, radio)
  enfocarSombra(centro, radio, distancia = 1500) {
    const s = this.sol;
    s.target.position.copy(centro);
    s.position.copy(centro).addScaledVector(this.solDir, distancia);
    const c = s.shadow.camera;
    c.left = -radio; c.right = radio; c.top = radio; c.bottom = -radio;
    c.near = 1; c.far = distancia * 2 + radio * 2;
    c.updateProjectionMatrix();
    s.shadow.normalBias = Math.max(0.02, radio / 900);
    s.shadow.bias = -0.00008 * Math.max(1, radio / 100);
  }

  // Atmósfera. Azimut en grados medido desde el sur (+z) hacia el este (+x): 90 = este, 0 = sur, -90 = oeste.
  atmosfera(o) {
    const { elev = 20, azim = 60, exposicion = 0.9, cenit = 0x3d6db4, horizonte = 0xe8d2b0, bajo = 0xc9a77c,
      niebla = null, densidad = 0.00022, solColor = 0xffe0b0, solInt = 3.2, cieloHemi = 0xbfd4ef, sueloHemi = 0xb08a60,
      hemiInt = 1.0, halo = 1.0, nubes = 0.35, brillo = 1.3 } = o;
    const phi = THREE.MathUtils.degToRad(90 - elev), th = THREE.MathUtils.degToRad(azim);
    this.solDir.setFromSphericalCoords(1, phi, th);
    const u = this.cielo.material.uniforms;
    u.cenit.value.set(cenit); u.horizonte.value.set(horizonte); u.bajo.value.set(bajo);
    u.solDir.value.copy(this.solDir); u.solColor.value.set(solColor);
    u.halo.value = halo; u.nubes.value = nubes; u.brillo.value = brillo;
    this.renderer.toneMappingExposure = exposicion;
    this.escena.fog.color.set(niebla ?? horizonte); this.escena.fog.density = densidad;
    this.sol.color.set(solColor); this.sol.intensity = solInt;
    this.hemi.color.set(cieloHemi); this.hemi.groundColor.set(sueloHemi); this.hemi.intensity = hemiInt;
  }

  // el cielo sigue a la cámara
  seguir(camara) { this.cielo.position.copy(camara.position); }

  _terreno() {
    const tam = 9000, seg = 420;
    const geo = new THREE.PlaneGeometry(tam, tam, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      let y = alturaTerreno(x, z);
      // la zona de la cantera la cubre un parche detallado; aquí se hunde
      const qx = Math.abs(x - CANTERA.x) - CANTERA.ancho / 2 - 30, qz = Math.abs(z - CANTERA.z) - CANTERA.largo / 2 - 30;
      if (Math.max(qx, qz) < 0) y -= 30;
      if (x > XQ - 40 && x < XQ + 60 && Math.abs(z - PUERTO.z) < 300) y -= 30;
      pos.setY(i, y);
      const n = fbm2(x * 0.004, z * 0.004, 3) * 0.5 + 0.5;
      const grava = fbm2(x * 0.0009 + 7, z * 0.0009, 3) * 0.5 + 0.5;
      const k = 0.86 + n * 0.16 - grava * 0.08;
      col[i * 3] = k * 1.0; col[i * 3 + 1] = k * 0.97; col[i * 3 + 2] = k * 0.93;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const arena = TX.texArena(true);
    for (const t of [arena.map, arena.normalMap, arena.roughnessMap]) t.repeat.set(tam / 9, tam / 9);
    const mat = new THREE.MeshStandardMaterial({ map: arena.map, normalMap: arena.normalMap, roughnessMap: arena.roughnessMap,
      normalScale: new THREE.Vector2(0.9, 0.9), vertexColors: true, roughness: 1, metalness: 0 });
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    this.terreno = m;
    this.escena.add(m);
    this.texArena = arena;

    // parche detallado alrededor de la cantera (mejor resolución del hoyo)
    const pw = CANTERA.ancho + 80, pl = CANTERA.largo + 80;
    const pg = new THREE.PlaneGeometry(pw, pl, 140, 110);
    pg.rotateX(-Math.PI / 2);
    const pp = pg.attributes.position;
    const pc = new Float32Array(pp.count * 3);
    for (let i = 0; i < pp.count; i++) {
      const x = pp.getX(i) + CANTERA.x, z = pp.getZ(i) + CANTERA.z;
      pp.setX(i, x); pp.setZ(i, z);
      pp.setY(i, alturaTerreno(x, z));
      const n = fbm2(x * 0.004, z * 0.004, 3) * 0.5 + 0.5;
      const k = 0.86 + n * 0.16;
      pc[i * 3] = k; pc[i * 3 + 1] = k * 0.97; pc[i * 3 + 2] = k * 0.93;
    }
    pg.setAttribute('color', new THREE.BufferAttribute(pc, 3));
    pg.computeVertexNormals();
    const parche = new THREE.Mesh(pg, mat);
    parche.receiveShadow = true;
    this.escena.add(parche);
    // parche detallado del puerto (orilla y muelle)
    const hw = 100, hl = 600;
    const hg = new THREE.PlaneGeometry(hw, hl, 50, 240);
    hg.rotateX(-Math.PI / 2);
    const hp = hg.attributes.position;
    const hc = new Float32Array(hp.count * 3);
    for (let i = 0; i < hp.count; i++) {
      const x = hp.getX(i) + XQ + 10, z = hp.getZ(i) + PUERTO.z;
      hp.setX(i, x); hp.setZ(i, z); hp.setY(i, alturaTerreno(x, z));
      const k = 0.86 + (fbm2(x * 0.004, z * 0.004, 3) * 0.5 + 0.5) * 0.16;
      hc[i * 3] = k; hc[i * 3 + 1] = k * 0.97; hc[i * 3 + 2] = k * 0.93;
    }
    hg.setAttribute('color', new THREE.BufferAttribute(hc, 3));
    hg.computeVertexNormals();
    const parcheP = new THREE.Mesh(hg, mat);
    parcheP.receiveShadow = true;
    this.escena.add(parcheP);
  }

  _valle() {
    const g = new THREE.Group();
    // campos de cultivo (rectángulos que dejan libres el puerto, el canal y el río)
    const campos = TX.texCampos();
    const matC = new THREE.MeshStandardMaterial({ map: campos.map, normalMap: campos.normalMap, roughness: 0.95 });
    const yC = NIVEL_VALLE + 1.2;
    const rects = [
      [560, 1750, 200, 4500], [850, 1750, -15, 200], [850, 1750, -4500, -105], [560, 850, -4500, -320],
      [2450, 6000, -4500, 4500],
    ];
    this.campos = new THREE.Group();
    for (const [x0, x1, z0, z1] of rects) {
      const w = x1 - x0, d = z1 - z0;
      const geo = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 240, uv.getY(i) * d / 240);
      const m = new THREE.Mesh(geo, matC);
      m.position.set((x0 + x1) / 2, yC, (z0 + z1) / 2); m.receiveShadow = true;
      this.campos.add(m);
      // talud de barro hacia el agua
      const talud = new THREE.Mesh(new THREE.BoxGeometry(w + 6, 1.4, d + 6), new THREE.MeshStandardMaterial({ color: 0x6e5a40, roughness: 1 }));
      talud.position.set((x0 + x1) / 2, yC - 0.75, (z0 + z1) / 2); talud.receiveShadow = true;
      this.campos.add(talud);
    }
    g.add(this.campos);

    // agua simple (lejana); la escena del Nilo usa agua reflectante
    const yA = NIVEL_VALLE + 0.5;
    this.matAguaLejana = new THREE.MeshStandardMaterial({ color: 0x54777c, roughness: 0.15, metalness: 0.0 });
    const rio = new THREE.Mesh(new THREE.PlaneGeometry(700, 9000).rotateX(-Math.PI / 2), this.matAguaLejana);
    rio.position.set(2100, yA, 0);
    g.add(rio);
    this.rioLejano = rio;
    const canal = new THREE.Mesh(new THREE.PlaneGeometry(900, 90).rotateX(-Math.PI / 2), this.matAguaLejana);
    canal.position.set(1300, yA, -60);
    g.add(canal);
    this.canalLejano = canal;
    const puerto = new THREE.Mesh(new THREE.PlaneGeometry(PUERTO.ancho, PUERTO.largo).rotateX(-Math.PI / 2), this.matAguaLejana);
    puerto.position.set(PUERTO.x, yA, PUERTO.z);
    g.add(puerto);
    this.puertoAgua = puerto;
    this.grupos.valle = g;
    this.escena.add(g);
  }

  _palmeras() {
    // palmeras datileras (tronco + corona de frondas), instanciadas
    const rnd = mulberry32(77);
    const pos = [];
    const borde = (x0, z0, z1, n, ancho) => { for (let i = 0; i < n; i++) pos.push([x0 + (rnd() - 0.5) * ancho, z0 + (z1 - z0) * rnd()]); };
    borde(PUERTO.x - PUERTO.ancho / 2 - 25, PUERTO.z - PUERTO.largo / 2, PUERTO.z + PUERTO.largo / 2, 40, 30);
    borde(PUERTO.x + PUERTO.ancho / 2 + 25, PUERTO.z - PUERTO.largo / 2, PUERTO.z + PUERTO.largo / 2, 40, 30);
    borde(1700, -3000, 3000, 220, 120);
    borde(2500, -3000, 3000, 220, 140);
    for (let i = 0; i < 260; i++) pos.push([700 + rnd() * 1300, -3000 + rnd() * 6000]);
    const filtradas = pos.filter(([x, z]) => !esAgua(x, z, 6));
    pos.length = 0; pos.push(...filtradas);
    const n = pos.length;
    const tronco = new THREE.CylinderGeometry(0.22, 0.35, 1, 6, 4, true); tronco.translate(0, 0.5, 0);
    const matT = new THREE.MeshStandardMaterial({ color: 0x6b5236, roughness: 1 });
    // fronda: plano curvado
    const fr = new THREE.PlaneGeometry(1, 0.9, 6, 1);
    const fp = fr.attributes.position;
    for (let i = 0; i < fp.count; i++) { const x = fp.getX(i) + 0.5; fp.setX(i, x * 4.2); fp.setY(i, fp.getY(i) * (1 - x * 0.7)); fp.setZ(i, -x * x * 2.4); }
    fr.rotateX(-Math.PI / 2 + 0.25);
    fr.computeVertexNormals();
    const matF = new THREE.MeshStandardMaterial({ color: 0x4f6a2c, roughness: 0.9, side: THREE.DoubleSide });
    const nf = 9;
    const mt = new THREE.InstancedMesh(tronco, matT, n);
    const mf = new THREE.InstancedMesh(fr, matF, n * nf);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    let k = 0;
    pos.forEach(([x, z], i) => {
      const h = 8 + rnd() * 9, y = Math.max(alturaTerreno(x, z), NIVEL_VALLE + 1.2);
      const incl = (rnd() - 0.5) * 0.18;
      e.set(incl, rnd() * 6.28, incl * 0.5); q.setFromEuler(e);
      m4.compose(p.set(x, y, z), q, s.set(1, h, 1)); mt.setMatrixAt(i, m4);
      const top = new THREE.Vector3(0, h, 0).applyQuaternion(q).add(p.set(x, y, z));
      for (let f = 0; f < nf; f++) {
        e.set(0, f / nf * Math.PI * 2 + rnd() * 0.5, 0); q.setFromEuler(e);
        const sc = 0.8 + rnd() * 0.4;
        m4.compose(top, q, s.set(sc, sc, sc)); mf.setMatrixAt(k++, m4);
      }
    });
    mt.castShadow = mf.castShadow = true;
    const g = new THREE.Group(); g.add(mt, mf);
    this.grupos.palmeras = g;
    this.escena.add(g);
  }

  _ciudad() {
    // Guiza actual: edificios bajos al este y sureste de la meseta (sólo en vistas actuales)
    const rnd = mulberry32(91);
    const n = 3400;
    const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
    // ventanas iluminadas (textura emisiva)
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
    for (let y = 8; y < 120; y += 16) for (let x = 6; x < 122; x += 14) if (rnd() < 0.35) { g.fillStyle = rnd() < 0.7 ? '#ffc67a' : '#fff0d0'; g.fillRect(x, y, 6, 7); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    this.matCiudad = new THREE.MeshStandardMaterial({ color: 0xb59c80, roughness: 0.9, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0 });
    // dos barrios: este (vistas actuales) y sureste (sólo en el plano final, de noche)
    const ims = [new THREE.InstancedMesh(geo, this.matCiudad, 2000), new THREE.InstancedMesh(geo, this.matCiudad, n - 2000)];
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    let i = 0;
    while (i < n) {
      let x, z;
      if (i < 2000) { x = 650 + rnd() * 3400; z = -2600 + rnd() * 4200; if (x < 900 && z > -300) continue; }
      else { x = 260 + rnd() * 1500; z = 640 + rnd() * 1700; if (x < 420 && z < 900) continue; }
      const w = 12 + rnd() * 24, d = 12 + rnd() * 24, h = 8 + rnd() * rnd() * 36;
      const y = Math.min(alturaTerreno(x, z), alturaTerreno(x + w / 2, z + d / 2), alturaTerreno(x - w / 2, z - d / 2)) - 0.5;
      m4.makeScale(w, h, d); m4.setPosition(x, y, z);
      const im = i < 2000 ? ims[0] : ims[1], j = i < 2000 ? i : i - 2000;
      im.setMatrixAt(j, m4);
      col.setHSL(0.08 + rnd() * 0.04, 0.2 + rnd() * 0.2, 0.45 + rnd() * 0.25); im.setColorAt(j, col);
      i++;
    }
    for (const im of ims) { im.castShadow = true; im.receiveShadow = true; }
    const gr = new THREE.Group(); gr.add(ims[0]);
    const grSE = new THREE.Group(); grSE.add(ims[1]); grSE.visible = false;
    this.grupos.ciudadSE = grSE;
    this.escena.add(grSE);
    gr.visible = false;
    this.grupos.ciudad = gr;
    this.escena.add(gr);
  }

  // Época: 'antigua' (campos, puerto) o 'actual' (ciudad)
  epoca(e) {
    const actual = e === 'actual';
    this.grupos.ciudad.visible = actual;
    if (!actual) this.grupos.ciudadSE.visible = false;
    this.campos.visible = !actual;
    this.puertoAgua.visible = !actual;
    this.canalLejano.visible = !actual;
    this.grupos.palmeras.visible = !actual;
  }
}
