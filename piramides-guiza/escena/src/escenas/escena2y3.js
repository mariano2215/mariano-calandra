// ESCENA 2 — EL COMIENZO (5–13 s): el rebobinado llega a los cimientos y un time-lapse
// muestra las primeras hiladas, con la cantera y las cuadrillas en la meseta.
// ESCENA 3 — EXTRAER LA PIEDRA (13–22 s): plano continuo que baja a la cantera, se acerca al
// cincel de cobre y sigue al bloque desde su extracción hasta quedar sobre el trineo.
import * as THREE from 'three';
import { obra, camara, PRESETS, mezclaPreset } from './comun.js';
import { Cantera, HEROE, PISO, BW, BH, BD } from '../cantera.js';
import { CANTERA } from '../mundo.js';
import { caminantes } from '../obra.js';
import { emitirPolvo } from '../objetos.js';
import { Pista, V, clamp, easeInOut, easeIn, smooth, hash } from '../util.js';
import { tituloCine, rotulo } from '../texto.js';

function cantera(ctx) { if (!ctx.cantera) ctx.cantera = new Cantera(ctx.mundo); return ctx.cantera; }

// ---------------- ESCENA 2 ----------------
const cam2 = new Pista([
  [5.0, V(80, 180, 250)],
  [6.2, V(330, 230, 560)],
  [9.5, V(330, 110, 380)],
  [13.0, V(230, 42, 300)],
]);
const mira2 = new Pista([
  [5.0, V(0, 92, 10)],
  [6.2, V(0, 10, 40)],
  [9.5, V(10, 0, 60)],
  [13.0, V(40, 0, 180)],
]);

export const plano2 = {
  id: '2', inicio: 5.0, fin: 13.0,
  preparar(ctx) { obra(ctx); cantera(ctx); },
  activar(ctx) { ctx.obra.visible(true); ctx.cantera.grupo.visible = true; ctx.mundo.epoca('antigua'); },
  desactivar(ctx) { ctx.obra.visible(false); ctx.cantera.grupo.visible = false; },
  actualizar(ctx, t, tl) {
    const o = ctx.obra, q = ctx.cantera;
    o.revestir(0); o.ocultarColocacion();
    for (const k in o.fantasmas) o.fantasmas[k].visible = false;
    // rebobinado hasta los cimientos (5,0–5,9) y luego time-lapse hacia adelante
    let n;
    if (t < 5.9) n = 62 * (1 - easeIn(clamp((t - 5.0) / 0.9)));
    else n = 7.6 * smooth(clamp((t - 6.1) / 6.9));
    o.nivel(n);
    // sol en time-lapse: amanecer → mañana
    const fs = clamp((t - 5.6) / 7.4);
    ctx.mundo.atmosfera(mezclaPreset(PRESETS.amanecer, PRESETS.manana, smooth(fs)));
    let k = 0;
    const vel = t < 5.9 ? -8 : 3.2; // time-lapse
    if (o.rampas.recta.visible) k = o.convoyes(t * Math.abs(vel), ctx.multitud, { velocidad: 0.6, cuantos: 10, retorno: 20, plataforma: 30 });
    // hileras de trabajadores entre cantera y obra
    k = caminantes(ctx.multitud, k, 160, t * 3, V(60, 0, 330), V(-10, 0, 130), { seed: 3, ancho: 30, vel: 1.2, carga: 0.3 });
    k = caminantes(ctx.multitud, k, 80, t * 3, V(600, 0, -40), V(130, 0, -20), { seed: 5, ancho: 25, vel: 1.2, carga: 0.2 });
    k = q.cuadrillas(t * 2, ctx.multitud, k, { n: 90, velocidad: 2 });
    k = q.arrastres(t * 3, ctx.multitud, k);
    // obreros sobre la base nivelada
    for (let i = 0; i < 120; i++) {
      const w = ctx.multitud.t(k++); if (!w) break;
      const a = hash(i * 3) * 6.28, r = 60 + hash(i * 7) * 70;
      const ang = a + t * 0.05 * (hash(i) - 0.5);
      w.visible = true; w.accion = hash(i * 11) < 0.5 ? 'caminar' : 'empujar';
      w.pos.set(Math.cos(ang) * r, o.h + (o.enCurso.im.count > 0 ? 0 : 0), Math.sin(ang) * r);
      w.yaw = -ang; w.fase = t * 3 * (0.6 + hash(i * 5) * 0.5);
    }
    camara(ctx, cam2.valor(t), mira2.valor(t), { fov: 46, cerca: 1.5, mano: 0.5, t });
    ctx.mundo.enfocarSombra(V(30, 0, 200), 420);
    const flash = t < 5.9 ? 0.15 * (1 - (t - 5) / 0.9) : 0;
    return { bloom: 0.35, rayos: 0.9, flash, sepia: t < 6.2 ? 0.2 * Math.exp(-(t - 3.3) * 2) : 0, contraste: 1.07 };
  },
  overlay(g, t) {
    tituloCine(g, ['HACE 4.500', 'AÑOS'], t, 6.0, 9.6, { y: 500, tam: 118 });
    rotulo(g, 'MESETA DE GUIZA · EGIPTO', 'c. 2560 a. C. · reinado de Keops', t, 9.9, 12.85, { x: 70, y: 420 });
  },
};

// ---------------- ESCENA 3 ----------------
const H = HEROE;
const golpes = (t, w) => { // instantes de impacto del mazo del trabajador w (fase 0.82)
  const fr = (t * w.frec + w.desfase) % 1;
  const ultimo = t - ((fr - 0.82 + 1) % 1) / w.frec;
  return ultimo;
};

const cam3 = new Pista([
  [13.0, V(H.x + 46, 14, H.z + 50)],
  [15.2, V(H.x + 10, -5.5, H.z + 9)],
  [16.6, V(H.x + 2.2, -9.4, H.z - 2.6)],
  [18.2, V(H.x + 1.5, -9.7, H.z - 2.2)],
  [18.9, V(H.x + 3.6, -8.1, H.z - 0.4)],
  [19.6, V(H.x + 3.2, -8.7, H.z + 3.8)],
  [21.0, V(H.x + 4.6, -8.9, H.z + 4.2)],
  [22.0, V(H.x + 6.6, -8.4, H.z + 5.0)],
]);
const mira3 = new Pista([
  [13.0, V(H.x - 4, PISO, H.z - 6)],
  [15.2, V(H.x, PISO + 0.6, H.z - 1)],
  [16.6, V(H.x - 0.1, PISO + 0.4, H.z - 0.75)],
  [18.2, V(H.x, PISO + 0.5, H.z - 0.7)],
  [19.6, V(H.x + 1.3, PISO + 0.8, H.z)],
  [21.0, V(H.x + 2.9, PISO + 0.9, H.z)],
  [22.0, V(H.x + 4.5, PISO + 0.9, H.z)],
]);

export const plano3 = {
  id: '3', inicio: 13.0, fin: 22.0,
  preparar(ctx) { obra(ctx); cantera(ctx); },
  activar(ctx) { ctx.obra.visible(true); ctx.cantera.grupo.visible = true; ctx.mundo.epoca('antigua'); },
  desactivar(ctx) { ctx.obra.visible(false); ctx.cantera.grupo.visible = false; },
  actualizar(ctx, t, tl) {
    const o = ctx.obra, q = ctx.cantera, M = ctx.multitud;
    o.revestir(0); o.ocultarColocacion();
    for (const k in o.fantasmas) o.fantasmas[k].visible = false;
    o.nivel(16.3); // la pirámide al fondo, en sus primeras etapas
    ctx.mundo.atmosfera(PRESETS.manana);
    let k = 0;
    // fondo de la cantera
    k = q.cuadrillas(t, M, k, { n: 70 });
    k = q.arrastres(t, M, k);
    if (o.rampas.recta.visible) k = o.convoyes(t, M, { desde: k, velocidad: 0.6, cuantos: 8, retorno: 10, plataforma: 10 });
    // --- bloque protagonista ---
    const b = q.heroe;
    const T_PAL = 18.3, T_DESL = 19.0, T_FIN = 20.9;
    const avance = smooth(clamp((t - T_DESL) / (T_FIN - T_DESL)));
    const ciclo = 0.9;
    const empuje = t > T_PAL && t < T_FIN ? Math.max(0, Math.sin((t - T_PAL) / ciclo * Math.PI * 2)) : 0;
    const subir = smooth(clamp((t - T_PAL) / 0.7)) * 0.32; // altura del trineo
    const x = H.x + avance * 2.9;
    b.position.set(x, PISO + BH / 2 + subir * (t < T_DESL ? empuje : 1) + (t < T_DESL ? 0 : 0.0), H.z);
    if (t >= T_DESL) b.position.y = PISO + BH / 2 + 0.32 * smooth(clamp((t - T_DESL) / 0.3)) + empuje * 0.03;
    b.rotation.set(0, 0, -empuje * 0.04);
    const trn = q.trineo.grupo;
    const arrastre = smooth(clamp((t - 21.15) / 0.85)) * 0.9;
    trn.position.set(H.x + 2.9 + arrastre, PISO, H.z);
    if (t > 21.15) b.position.x += arrastre;
    // canteros: cincel y mazo (hasta T_PAL)
    const canteros = [
      { pos: V(H.x - 0.05, PISO, H.z - 1.38), yaw: 0, punta: V(H.x - 0.1, PISO + 0.12, H.z - BD / 2 - 0.02) },
      { pos: V(H.x - BW / 2 - 0.55, PISO + BH, H.z - 0.35), yaw: Math.PI / 2, punta: V(H.x - BW / 2 - 0.17, PISO + BH - 0.05, H.z - 0.3) },
      { pos: V(H.x + 0.35, PISO + BH, H.z + 1.55), yaw: Math.PI, punta: V(H.x + 0.3, PISO + BH - 0.05, H.z + BD / 2 + 0.17) },
    ];
    q.esquirlas.iniciar(); q.polvo.iniciar();
    canteros.forEach((c, i) => {
      const w = M.t(k++);
      w.visible = true;
      if (t < T_PAL) {
        w.accion = 'martillar'; w.frec = 1.25 + i * 0.13; w.desfase = 0.2 + i * 0.31;
        w.pos.copy(c.pos); w.yaw = c.yaw;
        // esquirlas y polvo en los dos últimos golpes
        const tg = golpes(t, w);
        q.esquirlas.golpe(t, tg, c.punta, 12, Math.floor(tg * 100) + i * 7, PISO + (i === 0 ? 0.02 : BH - 0.02));
        q.esquirlas.golpe(t, tg - 1 / w.frec, c.punta, 12, Math.floor((tg - 1 / w.frec) * 100) + i * 7, PISO + (i === 0 ? 0.02 : BH - 0.02));
        emitirPolvo(q.polvo, t, c.punta, { tasa: 8, vida: 2.2, seed: i + 3, tam0: 0.15, tam1: 1.0, alfa: 0.4, dispersion: 0.2, viento: V(0.15, 0.2, 0.25) });
      } else {
        w.accion = 'parado'; w.pos.copy(c.pos).add(V(i === 0 ? -0.8 : 0, 0, i === 0 ? -0.8 : 0)); w.yaw = c.yaw + 0.5;
      }
    });
    // palancas (desde T_PAL): dos palancas en el canal oeste empujan el bloque al este
    for (let i = 0; i < 2; i++) {
      const p = q.palancas[i];
      const vis = t > T_PAL - 0.3 && t < T_FIN + 0.4;
      p.visible = vis;
      const z = H.z + (i ? 0.35 : -0.35);
      const a = 0.42 - empuje * 0.22;
      const d = V(-Math.cos(a), Math.sin(a), 0);
      const xp = b.position.x - BW / 2;
      const punta = V(xp + 0.22, PISO + 0.1, z);
      p.position.copy(punta).addScaledVector(d, 1.3);
      p.quaternion.setFromUnitVectors(V(0, 0, 1), d);
      if (vis) {
        const w = M.t(k++);
        w.visible = true; w.accion = 'palanca'; w.frec = 1 / ciclo; w.desfase = -T_PAL / ciclo + 0.75;
        w.pos.set(xp - 2.55, PISO, z + (i ? 0.25 : -0.25)); w.yaw = Math.PI / 2;
      }
      if (t > T_PAL - 0.1 && t < T_FIN + 0.5) emitirPolvo(q.polvo, t, V(b.position.x - BW / 2, PISO + 0.05, z), { tasa: 6, vida: 1.8, seed: 20 + i, tam0: 0.2, tam1: 1.2, alfa: 0.35, desde: T_PAL, viento: V(0.3, 0.15, 0.2) });
    }
    // equipo de arrastre que espera / empieza a tirar
    const tira = t > 21.0;
    const pts = [[q.trineo.frente ? null : null], []];
    trn.updateMatrixWorld();
    const cuerdaPts = [[q.trineo.frente(-0.45)], [q.trineo.frente(0.45)]];
    for (let j = 0; j < 8; j++) {
      const w = M.t(k++);
      const fila = Math.floor(j / 2), lado = j % 2 ? 1 : -1;
      w.visible = true;
      w.accion = tira ? 'tirar' : 'parado';
      w.ladoCuerda = -lado;
      const xx = trn.position.x + 3.6 + fila * 1.2;
      w.pos.set(xx, PISO, H.z + lado * 0.85); w.yaw = tira ? Math.PI / 2 : Math.PI / 2 + lado * 0.4;
      w.fase = xx / 1.0;
      cuerdaPts[j % 2].push(w.pos.clone().add(V(0.3, tira ? 1.25 : 0.9, 0)));
    }
    q.cuerdas.forEach((c, i) => { c.malla.visible = t > 20.5; if (c.malla.visible) c.actualizar(cuerdaPts[i], tira ? 0.05 : 0.6); });
    q.esquirlas.cerrar(); q.polvo.cerrar();
    void pts;
    // cámara
    const pos = cam3.valor(t), m = mira3.valor(t);
    camara(ctx, pos, m, { fov: t < 15 ? 46 : 40, cerca: 0.08, mano: t < 15.5 ? 0.25 : 0.025, t });
    const foco = pos.distanceTo(m);
    const cerca = smooth(clamp((t - 14.6) / 1.2));
    ctx.mundo.enfocarSombra(t < 15.5 ? V(H.x + 10, PISO, H.z) : V(H.x + 1.5, PISO, H.z), t < 15.5 ? 90 : 14);
    return { apertura: cerca * 1.1, foco, maxDesenfoque: 18, bloom: 0.3, rayos: 0.3 };
  },
};

export { CANTERA };
