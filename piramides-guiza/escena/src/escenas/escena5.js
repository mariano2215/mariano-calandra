// ESCENA 5 — MOVER TONELADAS SIN RUEDAS (32–43 s): trineo arrastrado por dos cuerdas mientras
// un trabajador vierte agua delante de los patines (como en la tumba de Dyehutihotep, c. 1900 a. C.);
// luego, comparación arena seca / arena húmeda (experimento de Fall et al., 2014).
import * as THREE from 'three';
import { obra, camara, PRESETS } from './comun.js';
import { Trineo, Cuerda, Particulas, emitirPolvo, manchaHumeda, materiales } from '../objetos.js';
import { alturaTerreno } from '../mundo.js';
import { Pista, V, clamp, smooth, easeInOut, hash } from '../util.js';
import { ecuacion, barrasFuerza, etiqueta, ORO } from '../texto.js';

const ZH = 140;

function set5(ctx) {
  if (ctx.s5) return ctx.s5;
  const g = new THREE.Group();
  const trineos = [new Trineo({}), new Trineo({})];
  for (const t of trineos) g.add(t.grupo);
  const cuerdas = [0, 1, 2, 3].map(() => { const c = new Cuerda(0.026); g.add(c.malla); return c; });
  // manchas de arena húmeda
  const matH = manchaHumeda();
  const manchas = [];
  for (let i = 0; i < 70; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), matH); m.receiveShadow = true; g.add(m); manchas.push(m); }
  // montículos de arena seca delante de los patines
  const matA = new THREE.MeshStandardMaterial({ map: ctx.mundo.texArena.map, color: 0xf0dcc0, roughness: 1 });
  const mont = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), matA); m.castShadow = m.receiveShadow = true; g.add(m); return m; });
  const agua = new Particulas(400, { color: 0xcfe6ff, opacidad: 0.9 });
  const polvo = new Particulas(400, { color: 0xe8d6b8, opacidad: 0.5 });
  g.add(agua.malla, polvo.malla);
  g.visible = false;
  ctx.mundo.escena.add(g);
  ctx.s5 = { g, trineos, cuerdas, manchas, mont, agua, polvo };
  return ctx.s5;
}

const suelo = (x, z) => alturaTerreno(x, z);

// Coloca un trineo con su equipo; devuelve k
function equipo(ctx, k, tr, cuerdas, x, z, t, { porCuerda = 10, tension = 1, lento = false } = {}) {
  const M = ctx.multitud;
  tr.grupo.position.set(x, suelo(x, z), z);
  tr.grupo.rotation.set(0, -Math.PI / 2, 0);
  tr.grupo.updateMatrixWorld();
  const pts = [[tr.frente(-0.45)], [tr.frente(0.45)]];
  for (let j = 0; j < porCuerda * 2; j++) {
    const w = M.t(k++); if (!w) break;
    const fila = Math.floor(j / 2), lado = j % 2 ? 1 : -1;
    const xx = x - 3.5 - fila * 1.12;
    w.visible = true; w.accion = 'tirar'; w.ladoCuerda = -lado;
    w.pos.set(xx, suelo(xx, z), z + lado * (0.8 + (fila % 2) * 0.1)); w.yaw = -Math.PI / 2;
    w.fase = (-xx) / (lento ? 0.55 : 0.95) + w.desfase;
    pts[j % 2].push(w.pos.clone().add(V(-0.32, 1.27 * w.escala, 0)));
  }
  cuerdas[0].actualizar(pts[0], 0.04 / tension); cuerdas[1].actualizar(pts[1], 0.04 / tension);
  return k;
}

// Aguador delante de los patines: chorro y salpicaduras deterministas
function aguador(ctx, k, x, z, t, S) {
  const M = ctx.multitud;
  const w = M.t(k++);
  w.visible = true; w.accion = 'verter';
  w.pos.set(x - 2.35, suelo(x - 2.35, z), z - 1.05); w.yaw = -Math.PI / 2 + 0.75; w.fase = -x / 0.8;
  // el chorro sale de la jarra; la boca se calcula en multitud.actualizar, aquí se estima
  const boca = w.pos.clone().add(V(0.45, 1.02, 0.42));
  const destino = V(x - 1.75, suelo(x - 1.75, z) + 0.02, z - 0.35);
  for (let i = 0; i < 26; i++) {
    const f = ((t * 3.2 + i / 26) % 1);
    const p = boca.clone().lerp(destino, f); p.y += Math.sin(f * Math.PI) * 0.12 - f * f * 0.05;
    S.agua.agregar(p, 0.07 + f * 0.05, 0.75);
  }
  for (let i = 0; i < 18; i++) {
    const h1 = hash(i * 7 + Math.floor(t * 6) * 31), h2 = hash(i * 11 + Math.floor(t * 6) * 17);
    const e = (t * 6) % 1;
    const p = destino.clone().add(V((h1 - 0.5) * 0.5 * e, 0.25 * Math.sin(e * Math.PI) * h2, (h2 - 0.5) * 0.5 * e));
    S.agua.agregar(p, 0.05 + 0.05 * h2, 0.6 * (1 - e));
  }
  return k;
}

function manchasHumedas(S, x, z, desde, iMin = 0) {
  // rastro mojado desde 'desde' hasta delante del trineo
  let i = iMin;
  for (let xx = desde; xx > x - 2.0 && i < S.manchas.length; xx -= 0.7) {
    for (const lado of [-0.6, 0.6]) {
      const m = S.manchas[i++]; if (!m) break;
      m.visible = true; m.position.set(xx + hash(i) * 0.2, suelo(xx, z) + 0.035, z + lado + (hash(i * 3) - 0.5) * 0.2);
      m.scale.set(1.3 + hash(i * 5) * 0.5, 1, 1.0 + hash(i * 7) * 0.4);
      m.rotation.y = hash(i * 9) * 3;
    }
  }
  return i;
}

// 5a: el equipo avanza hacia la cámara (vista frontal-lateral, baja)
const cam5a = new Pista([[32.0, V(-21, 1.5, 6.5)], [34.7, V(-19.5, 1.9, 7.5)]]);
const mira5a = new Pista([[32.0, V(-7, 1.2, 0)], [34.7, V(-5, 1.0, 0)]]);
// 5a2: primer plano del agua sobre la arena delante del patín
const cam5c = new Pista([[34.7, V(-3.7, 1.05, 2.6)], [36.4, V(-3.2, 0.8, 2.0)]]);
const mira5c = new Pista([[34.7, V(-1.95, 0.4, -0.45)], [36.4, V(-1.85, 0.25, -0.4)]]);

function base5a(ctx, t) {
  const S = set5(ctx), o = ctx.obra;
  o.nivel(40.5); o.revestir(0); o.ocultarColocacion();
  for (const kk in o.fantasmas) o.fantasmas[kk].visible = false;
  S.trineos[1].grupo.visible = false; S.cuerdas[2].malla.visible = S.cuerdas[3].malla.visible = false;
  for (const m of S.manchas) m.visible = false;
  for (const m of S.mont) m.visible = false;
  S.agua.iniciar(); S.polvo.iniciar();
  const x = 205 - (t - 32.0) * 0.75;
  let k = equipo(ctx, 0, S.trineos[0], S.cuerdas, x, ZH, t);
  k = aguador(ctx, k, x, ZH, t, S);
  manchasHumedas(S, x, ZH, 212);
  emitirPolvo(S.polvo, t, V(x + 1.4, suelo(x, ZH) + 0.05, ZH), { tasa: 5, vida: 2.5, seed: 4, tam0: 0.3, tam1: 1.4, alfa: 0.18, viento: V(0.6, 0.15, 0.3) });
  for (let j = 0; j < 20; j += 3) { const w = ctx.multitud.t(j); if (w) emitirPolvo(S.polvo, t, w.pos.clone().add(V(0.2, 0.05, 0)), { tasa: 2, vida: 1.6, seed: 30 + j, tam0: 0.2, tam1: 0.8, alfa: 0.12 }); }
  if (o.rampas.recta.visible) k = o.convoyes(t, ctx.multitud, { desde: k, velocidad: 0.6, cuantos: 10, retorno: 20, plataforma: 20 });
  S.agua.cerrar(); S.polvo.cerrar();
  return V(x, suelo(x, ZH), ZH);
}

export const plano5a = {
  id: '5a', inicio: 32.0, fin: 34.7,
  preparar(ctx) { obra(ctx); set5(ctx); },
  activar(ctx) { ctx.obra.visible(true); ctx.s5.g.visible = true; ctx.mundo.epoca('antigua'); ctx.mundo.atmosfera(PRESETS.mediodia); },
  desactivar(ctx) { ctx.obra.visible(false); ctx.s5.g.visible = false; },
  actualizar(ctx, t) {
    const base = base5a(ctx, t);
    const pos = cam5a.valor(t).add(base), m = mira5a.valor(t).add(base);
    camara(ctx, pos, m, { fov: 44, cerca: 0.1, mano: 0.05, t });
    ctx.mundo.enfocarSombra(base.clone().add(V(-7, 0, 0)), 20);
    return { apertura: 0.45, foco: pos.distanceTo(m), maxDesenfoque: 12, bloom: 0.3, rayos: 0.2 };
  },
};

export const plano5a2 = {
  id: '5a2', inicio: 34.7, fin: 36.4,
  preparar(ctx) { obra(ctx); set5(ctx); },
  activar(ctx) { ctx.obra.visible(true); ctx.s5.g.visible = true; ctx.mundo.epoca('antigua'); ctx.mundo.atmosfera(PRESETS.mediodia); },
  desactivar(ctx) { ctx.obra.visible(false); ctx.s5.g.visible = false; },
  actualizar(ctx, t) {
    const base = base5a(ctx, t);
    const pos = cam5c.valor(t).add(base), m = mira5c.valor(t).add(base);
    camara(ctx, pos, m, { fov: 38, cerca: 0.05, mano: 0.02, t });
    ctx.mundo.enfocarSombra(base, 8);
    return { apertura: 1.3, foco: pos.distanceTo(m), maxDesenfoque: 16, bloom: 0.3, rayos: 0.2 };
  },
};

const cam5b = new Pista([[36.4, V(-25, 13, 1.0)], [43.0, V(-27, 15, 1.5)]]);

export const plano5b = {
  id: '5b', inicio: 36.4, fin: 43.0,
  preparar(ctx) { obra(ctx); set5(ctx); },
  activar(ctx) { ctx.obra.visible(true); ctx.s5.g.visible = true; ctx.mundo.epoca('antigua'); ctx.mundo.atmosfera(PRESETS.mediodia); },
  desactivar(ctx) { ctx.obra.visible(false); ctx.s5.g.visible = false; },
  actualizar(ctx, t, tl) {
    const S = set5(ctx), o = ctx.obra;
    o.nivel(41); o.revestir(0); o.ocultarColocacion();
    for (const kk in o.fantasmas) o.fantasmas[kk].visible = false;
    S.agua.iniciar(); S.polvo.iniciar();
    for (const m of S.manchas) m.visible = false;
    const zSeca = ZH + 6.5, zHum = ZH;
    const xS = 205 - tl * 0.28 - Math.max(0, Math.sin(tl * 3.2)) * 0.05; // a tirones
    const xH = 205 - tl * 0.85;
    S.trineos[1].grupo.visible = true;
    let k = equipo(ctx, 0, S.trineos[0], S.cuerdas.slice(0, 2), xH, zHum, t);
    k = equipo(ctx, k, S.trineos[1], S.cuerdas.slice(2, 4), xS, zSeca, t, { lento: true, tension: 2 });
    for (const c of S.cuerdas) c.malla.visible = true;
    k = aguador(ctx, k, xH, zHum, t, S);
    manchasHumedas(S, xH, zHum, 208);
    // montículos de arena seca que crecen delante de los patines
    const crec = 0.25 + clamp(tl / 4) * 0.25;
    S.mont.forEach((m, i) => {
      m.visible = true;
      m.position.set(xS - 1.75, suelo(xS, zSeca) - 0.02, zSeca + (i ? 0.62 : -0.62));
      m.scale.set(0.45 + crec * 0.4, crec * 0.8, 0.35 + crec * 0.2);
      emitirPolvo(S.polvo, t, m.position.clone().add(V(0, 0.1, 0)), { tasa: 7, vida: 2.0, seed: 50 + i, tam0: 0.25, tam1: 1.4, alfa: 0.3, viento: V(0.5, 0.25, 0.2) });
    });
    S.agua.cerrar(); S.polvo.cerrar();
    const base = V(205 - 2.0, suelo(205, ZH), ZH + 3.2);
    camara(ctx, cam5b.valor(t).add(base), base.clone().add(V(-3.0, 0.0, 0)), { fov: 40, cerca: 0.2, mano: 0.05, t });
    ctx.mundo.enfocarSombra(base, 22);
    ctx.s5.etiquetas = [V(xS + 0.2, suelo(xS, zSeca) + 2.5, zSeca), V(xH + 0.2, suelo(xH, zHum) + 2.5, zHum)];
    return { bloom: 0.3, rayos: 0.15, apertura: 0.2, foco: ctx.camara.position.distanceTo(base), maxDesenfoque: 8 };
  },
  overlay(g, t, tl, ctx) {
    ecuacion(g, t, 37.0, 42.85, { y: 330 });
    barrasFuerza(g, t, 40.0, 42.85, { y: 1330 });
    if (ctx.s5 && ctx.s5.etiquetas && t > 36.6) {
      const [a, b] = ctx.s5.etiquetas.map((v) => v.clone().project(ctx.camara));
      const W = g.canvas.width, H = g.canvas.height;
      const pa = [(a.x * 0.5 + 0.5) * W, (-a.y * 0.5 + 0.5) * H], pb = [(b.x * 0.5 + 0.5) * W, (-b.y * 0.5 + 0.5) * H];
      etiquetaFlotante(g, 'ARENA SECA', pa, '#F0C987', t, 36.7, 42.9);
      etiquetaFlotante(g, 'ARENA HÚMEDA', pb, '#9FD8FF', t, 36.9, 42.9);
    }
  },
};

function etiquetaFlotante(g, txt, [x, y], color, t, ini, fin) {
  if (t < ini || t > fin) return;
  const a = Math.min(clamp((t - ini) / 0.3), clamp((fin - t) / 0.3));
  g.save();
  g.globalAlpha = a;
  g.font = '800 34px Montserrat';
  try { g.letterSpacing = '3px'; } catch (e) { /* */ }
  const w = g.measureText(txt).width + 36;
  g.fillStyle = 'rgba(12,8,3,0.65)';
  g.beginPath(); g.roundRect(x - w / 2, y - 64, w, 54, 14); g.fill();
  g.strokeStyle = color; g.lineWidth = 3; g.stroke();
  g.beginPath(); g.moveTo(x, y - 10); g.lineTo(x, y + 18); g.stroke();
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(txt, x, y - 36);
  g.restore();
}
