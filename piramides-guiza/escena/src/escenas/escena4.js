// ESCENA 4 — EL TRANSPORTE POR EL NILO (22–32 s): vista aérea del río y el canal, barco de carga
// a remo con bloques de caliza de Tura (como en el Diario de Merer), y descarga en el puerto.
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { obra, camara, PRESETS } from './comun.js';
import { Barco, Trineo, Cuerda, muelle, Particulas, emitirPolvo } from '../objetos.js';
import { NIVEL_VALLE, PUERTO, alturaTerreno, XQ, AGUA } from '../mundo.js';
import { caminantes } from '../obra.js';
import { normalesAgua } from '../texturas.js';
import { Pista, V, clamp, smooth, easeInOut, hash } from '../util.js';


function nilo(ctx) {
  if (ctx.nilo) return ctx.nilo;
  const g = new THREE.Group();
  const nm = normalesAgua();
  const agua = new Water(new THREE.PlaneGeometry(5200, 9000), {
    textureWidth: 512, textureHeight: 1024, waterNormals: nm, sunDirection: ctx.mundo.solDir.clone(),
    sunColor: 0xfff0d0, waterColor: 0x1d4a50, distortionScale: 2.2, fog: true,
  });
  // menos reflejo especular del cielo (agua del Nilo más turbia y oscura)
  agua.material.fragmentShader = agua.material.fragmentShader
    .replace('vec3( 0.1 ) + reflectionSample * 0.9', 'vec3( 0.03, 0.06, 0.06 ) + reflectionSample * 0.5');
  agua.material.needsUpdate = true;
  agua.rotation.x = -Math.PI / 2;
  agua.position.set(1900, AGUA, 0);
  agua.material.uniforms.size.value = 3.0;
  g.add(agua);
  // barcos
  const heroe = new Barco({ largo: 24, manga: 5, remeros: 7, vela: false, carga: 3, seed: 2 });
  const velero = new Barco({ largo: 22, manga: 4.6, remeros: 0, vela: true, carga: 0, seed: 3 });
  const remo2 = new Barco({ largo: 26, manga: 5.4, remeros: 8, vela: false, carga: 2, seed: 4 });
  const atracados = [0, 1, 2].map((i) => new Barco({ largo: 22 + i * 2, manga: 5, remeros: 5, vela: false, carga: i === 0 ? 1 : 2, seed: 10 + i }));
  for (const b of [heroe, velero, remo2, ...atracados]) g.add(b.grupo);
  // muelle de piedra
  const mq = muelle(V(XQ - 1.45, AGUA - 1.45, -240), V(XQ - 1.45, AGUA - 1.45, 160), 4);
  g.add(mq);
  // rampa de tablones del barco al muelle y trineos en el muelle
  const tablon = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.12, 2.2), atracados[0].remos[0].children[0].material);
  tablon.castShadow = tablon.receiveShadow = true; g.add(tablon);
  const trineos = [0, 1, 2, 3].map(() => { const tr = new Trineo({ matBloque: atracados[0].bloques[0].material }); g.add(tr.grupo); return tr; });
  const cuerdas = [0, 1, 2, 3, 4, 5, 6, 7].map(() => { const c = new Cuerda(0.024); g.add(c.malla); return c; });
  const espuma = new Particulas(300, { color: 0xffffff, opacidad: 0.45 });
  g.add(espuma.malla);
  g.visible = false;
  ctx.mundo.escena.add(g);
  ctx.nilo = { g, agua, heroe, velero, remo2, atracados, tablon, trineos, cuerdas, espuma };
  return ctx.nilo;
}

function activarNilo(ctx) {
  const N = ctx.nilo;
  N.g.visible = true;
  ctx.obra.visible(true);
  ctx.mundo.epoca('antigua');
  ctx.mundo.puertoAgua.visible = false; ctx.mundo.rioLejano.visible = false; ctx.mundo.canalLejano.visible = false;
  ctx.mundo.atmosfera(PRESETS.manana);
  N.agua.material.uniforms.sunDirection.value.copy(ctx.mundo.solDir);
}
function desactivarNilo(ctx) {
  ctx.nilo.g.visible = false; ctx.obra.visible(false);
  ctx.mundo.rioLejano.visible = true; ctx.mundo.canalLejano.visible = true; ctx.mundo.puertoAgua.visible = true;
}

// remeros sobre un barco
function tripular(M, k, barco, t, frec = 0.55, desfase = 0) {
  barco.grupo.updateMatrixWorld();
  const f = (t * frec + desfase) % 1;
  barco.remar(f);
  const yawB = barco.grupo.rotation.y;
  for (const p of barco.puestosRemeros()) {
    const w = M.t(k++); if (!w) return k;
    w.visible = true; w.accion = 'remar'; w.frec = frec; w.desfase = desfase + 0.25;
    w.pos.copy(p.pos).applyMatrix4(barco.grupo.matrixWorld);
    w.yaw = yawB - Math.PI / 2;
  }
  // timonel
  const w = M.t(k++);
  if (w) { w.visible = true; w.accion = 'parado'; w.pos.set(-barco.largo * 0.36, barco.cubierta, 0).applyMatrix4(barco.grupo.matrixWorld); w.yaw = yawB + Math.PI / 2; }
  return k;
}

function posBarcos(N, t) {
  // héroe por el canal hacia el oeste
  const xh = 1235 - (t - 22) * 2.6;
  N.heroe.grupo.position.set(xh, AGUA + Math.sin(t * 1.3) * 0.04, -62);
  N.heroe.grupo.rotation.set(Math.sin(t * 0.9) * 0.008, Math.PI, Math.sin(t * 1.1) * 0.01);
  // velero remontando el río (hacia el sur, +z) con viento del norte
  N.velero.grupo.position.set(2010, AGUA, 30 + (t - 22) * 3.2);
  N.velero.grupo.rotation.set(0, -Math.PI / 2, Math.sin(t * 0.8) * 0.012);
  // barco a remo bajando el río (hacia el norte, -z)
  N.remo2.grupo.position.set(2150, AGUA, 250 - (t - 22) * 2.2);
  N.remo2.grupo.rotation.set(0, Math.PI / 2, 0);
  // atracados junto al muelle
  N.atracados.forEach((b, i) => {
    b.grupo.position.set(XQ + 4.2, AGUA + Math.sin(t + i) * 0.03, -62 + (i - 0) * 30 - (i ? 0 : 0));
    b.grupo.rotation.set(0, Math.PI / 2, Math.sin(t * 0.7 + i) * 0.006);
    b.remar(0.1);
  });
}

function estela(N, t) {
  const E = N.espuma; E.iniciar();
  const proa = N.heroe.grupo.position.clone().add(V(-12, 0.2, 0));
  for (let i = 0; i < 40; i++) {
    const h = hash(i * 13), e = (t * 2 + h * 4) % 4;
    const p = proa.clone().add(V(e * 2.6 + 2, -0.05, (h - 0.5) * (2 + e * 1.2) + Math.sign(h - 0.5) * 2.4));
    E.agregar(p, 0.8 + e * 0.6, 0.35 * (1 - e / 4));
  }
  // remos: salpicaduras
  for (const r of N.heroe.remos) {
    const pr = V(0, -4.4, 0).applyMatrix4(r.matrixWorld);
    if (pr.y < AGUA + 0.3) E.agregar(V(pr.x, AGUA + 0.15, pr.z), 0.9, 0.4);
  }
  E.cerrar();
}

const cam4a = new Pista([[22.0, V(1880, 40, -70)], [25.2, V(1915, 22, 0)]]);
const mira4a = new Pista([[22.0, V(2150, -26, 220)], [25.2, V(2120, -22, 200)]]);

export const plano4a = {
  id: '4a', inicio: 22.0, fin: 25.2,
  preparar(ctx) { obra(ctx); nilo(ctx); },
  activar(ctx) { activarNilo(ctx); },
  desactivar(ctx) { desactivarNilo(ctx); },
  actualizar(ctx, t) {
    const N = ctx.nilo, o = ctx.obra, M = ctx.multitud;
    o.nivel(26); o.revestir(0); o.ocultarColocacion();
    posBarcos(N, t);
    let k = 0;
    k = tripular(M, k, N.heroe, t, 0.55);
    k = tripular(M, k, N.remo2, t, 0.5, 0.3);
    N.agua.material.uniforms.time.value = t * 0.6;
    estela(N, t);
    // detrás y por encima del velero que remonta el río; brillo del sol a la izquierda
    const f = smooth(clamp((t - 22) / 3.2));
    const vp = N.velero.grupo.position;
    camara(ctx, vp.clone().add(V(-48 + 8 * f, 30 - 10 * f, -80 + 18 * f)), vp.clone().add(V(28, -2, 150)), { fov: 48, cerca: 1, mano: 0.3, t });
    ctx.mundo.enfocarSombra(V(1900, AGUA, -100), 400);
    return { bloom: 0.45, rayos: 0.4, contraste: 1.06 };
  },
};

export const plano4b = {
  id: '4b', inicio: 25.2, fin: 28.6,
  preparar(ctx) { obra(ctx); nilo(ctx); },
  activar(ctx) { activarNilo(ctx); },
  desactivar(ctx) { desactivarNilo(ctx); },
  actualizar(ctx, t, tl) {
    const N = ctx.nilo, o = ctx.obra, M = ctx.multitud;
    o.nivel(26); o.revestir(0); o.ocultarColocacion();
    posBarcos(N, t);
    let k = tripular(M, 0, N.heroe, t, 0.55);
    N.agua.material.uniforms.time.value = t * 0.6;
    estela(N, t);
    const b = N.heroe.grupo.position;
    const f = smooth(clamp(tl / 3.4));
    const pos = V(b.x - 3 - f * 6, AGUA + 2.6 + f * 0.8, b.z + 19 - f * 3);
    camara(ctx, pos, V(b.x - 1.5, AGUA + 1.8, b.z), { fov: 44, cerca: 0.5, mano: 0.12, t });
    ctx.mundo.enfocarSombra(V(b.x, AGUA, b.z), 30);
    return { bloom: 0.4, rayos: 0.3, apertura: 0.25, foco: pos.distanceTo(b), maxDesenfoque: 10 };
  },
};

const cam4c = new Pista([[28.6, V(622, AGUA + 2.4, -36)], [30.4, V(628, AGUA + 8, -26)], [32.0, V(642, AGUA + 20, -14)]]);
const mira4c = new Pista([[28.6, V(XQ + 1, AGUA + 2.2, -62)], [30.4, V(XQ - 12, AGUA + 5, -64)], [32.0, V(XQ - 140, AGUA + 30, -60)]]);

export const plano4c = {
  id: '4c', inicio: 28.6, fin: 32.0,
  preparar(ctx) { obra(ctx); nilo(ctx); },
  activar(ctx) { activarNilo(ctx); },
  desactivar(ctx) { desactivarNilo(ctx); },
  actualizar(ctx, t, tl) {
    const N = ctx.nilo, o = ctx.obra, M = ctx.multitud;
    o.nivel(28); o.revestir(0); o.ocultarColocacion();
    posBarcos(N, t);
    N.agua.material.uniforms.time.value = t * 0.6;
    N.espuma.iniciar(); N.espuma.cerrar();
    let k = 0;
    // descarga: trineo con bloque subiendo por el tablón del barco al muelle
    const bq = N.atracados[0];
    bq.grupo.updateMatrixWorld();
    const QY = AGUA + 2.5; // superficie del muelle
    N.tablon.position.set(XQ + 1.0, (QY + bq.grupo.position.y + bq.cubierta) / 2, -62);
    N.tablon.rotation.set(0, 0, Math.atan2(QY - (bq.grupo.position.y + bq.cubierta), 3.0));
    const fd = smooth(clamp((t - 28.6) / 3.2));
    const tr0 = N.trineos[0];
    const x0 = XQ + 3.2, x1 = XQ - 4.5;
    const xs = x0 + (x1 - x0) * fd;
    const ys = xs > XQ + 2.4 ? bq.grupo.position.y + bq.cubierta : xs > XQ - 0.4 ? QY - (xs - (XQ - 0.4)) / 2.8 * (QY - bq.grupo.position.y - bq.cubierta) : QY;
    tr0.grupo.position.set(xs, ys, -62); tr0.grupo.rotation.set(0, -Math.PI / 2, 0);
    tr0.grupo.updateMatrixWorld();
    // equipo que tira desde el muelle
    const pts = [[tr0.frente(-0.45)], [tr0.frente(0.45)]];
    for (let j = 0; j < 10; j++) {
      const w = M.t(k++);
      const fila = Math.floor(j / 2), lado = j % 2 ? 1 : -1;
      const xx = xs - 3.6 - fila * 1.15;
      w.visible = true; w.accion = 'tirar'; w.ladoCuerda = -lado;
      w.pos.set(xx, QY, -62 + lado * 0.85); w.yaw = -Math.PI / 2; w.fase = -xx / 1.0;
      pts[j % 2].push(w.pos.clone().add(V(-0.3, 1.25, 0)));
    }
    N.cuerdas[0].actualizar(pts[0], 0.05); N.cuerdas[1].actualizar(pts[1], 0.05);
    // otros trineos ya en el muelle siendo arrastrados hacia la meseta
    for (let i = 1; i < 4; i++) {
      const tr = N.trineos[i];
      const d = ((t - 28.6) * 0.7 + i * 14) % 60;
      const x = XQ - 8 - d;
      const y = Math.max(alturaTerreno(x, -40 + i * 9), QY);
      tr.grupo.position.set(x, y, -40 + i * 9 - 30); tr.grupo.rotation.set(0, -Math.PI / 2, 0); tr.grupo.updateMatrixWorld();
      const pp = [[tr.frente(-0.45)], [tr.frente(0.45)]];
      for (let j = 0; j < 8; j++) {
        const w = M.t(k++);
        const fila = Math.floor(j / 2), lado = j % 2 ? 1 : -1;
        const xx = x - 3.6 - fila * 1.15;
        w.visible = true; w.accion = 'tirar'; w.ladoCuerda = -lado;
        w.pos.set(xx, Math.max(alturaTerreno(xx, tr.grupo.position.z), QY), tr.grupo.position.z + lado * 0.85); w.yaw = -Math.PI / 2; w.fase = -xx;
        pp[j % 2].push(w.pos.clone().add(V(-0.3, 1.25, 0)));
      }
      N.cuerdas[i * 2].actualizar(pp[0], 0.05); N.cuerdas[i * 2 + 1].actualizar(pp[1], 0.05);
    }
    // gente en el muelle y en los barcos
    k = caminantes(M, k, 40, t, V(XQ - 3, 0, -200), V(XQ - 3, 0, 120), { seed: 9, ancho: 5, vel: 1.1, carga: 0.4 });
    for (let i = 0; i < 40; i++) { const w = M.t(k - 40 + i); if (w) w.pos.y = Math.max(w.pos.y, QY); }
    for (let i = 1; i < 3; i++) k = tripular(M, k, N.atracados[i], t, 0.0, i * 0.3);
    // caravana hacia la meseta
    k = caminantes(M, k, 70, t, V(XQ - 20, 0, -60), V(260, 0, -40), { seed: 12, ancho: 14, vel: 1.1, carga: 0.3 });
    if (o.rampas.recta.visible) k = o.convoyes(t, M, { desde: k, velocidad: 0.6, cuantos: 8, retorno: 0, plataforma: 0 });
    camara(ctx, cam4c.valor(t), mira4c.valor(t), { fov: 46, cerca: 0.3, mano: 0.12, t });
    ctx.mundo.enfocarSombra(V(XQ - 10, AGUA, -50), 60);
    const pos = ctx.camara.position;
    return { bloom: 0.4, rayos: 0.35, apertura: 0.2, foco: pos.distanceTo(tr0.grupo.position), maxDesenfoque: 8 };
  },
};
