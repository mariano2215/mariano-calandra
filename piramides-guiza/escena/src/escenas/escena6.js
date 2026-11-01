// ESCENA 6 — SUBIR LOS BLOQUES (43–56 s): rampa hipotética, palancas, crecimiento capa por capa,
// y alternativas de rampa (recta / zigzag / espiral) como hologramas: el diseño exacto es incierto.
import * as THREE from 'three';
import { obra, camara, PRESETS } from './comun.js';
import { Pista, V, clamp, inv, easeInOut, smooth } from '../util.js';
import { semi } from '../piramide.js';
import { etiqueta, rotuloHipotesis } from '../texto.js';

const nivelEn = (t) => 50 + (t - 43) * 1.5; // hiladas: time-lapse 50 → 56,5

function comunActivar(ctx) {
  const o = obra(ctx);
  o.visible(true);
  ctx.mundo.epoca('antigua');
  ctx.mundo.atmosfera(PRESETS.tarde);
}

export const plano6a = {
  id: '6a', inicio: 43.0, fin: 47.3,
  preparar(ctx) { obra(ctx); },
  activar(ctx) { comunActivar(ctx); },
  desactivar(ctx) { ctx.obra.visible(false); },
  actualizar(ctx, t, tl) {
    const o = ctx.obra;
    o.nivel(nivelEn(t));
    o.ocultarColocacion();
    for (const k in o.fantasmas) o.fantasmas[k].visible = false;
    o.rampas.matAdobe.opacity = 1; o.rampas.matAdobe.transparent = false;
    let k = o.convoyes(t, ctx.multitud, { velocidad: 1.6, cuantos: 16 });
    void k;
    // grúa ascendente junto a la rampa: trineos en primer término, la obra detrás
    const f = easeInOut(clamp(tl / 4.3));
    const pos = V(70 + 60 * f, 34 + 50 * f, 360 - 70 * f);
    camara(ctx, pos, V(-25, 38 + 14 * f, 150 - 60 * f), { fov: 44, cerca: 1, mano: 0.35, t });
    ctx.mundo.enfocarSombra(V(-10, 30, 220), 300);
    return { bloom: 0.3, rayos: 0.6, apertura: 0 };
  },
  overlay(g, t) { etiqueta(g, 'RECONSTRUCCIÓN HIPOTÉTICA', t, 43.3, 56.0, { x: 60, y: 290 }); },
};

export const plano6b = {
  id: '6b', inicio: 47.3, fin: 50.3,
  preparar(ctx) { obra(ctx); },
  activar(ctx) { comunActivar(ctx); },
  desactivar(ctx) { ctx.obra.visible(false); ctx.obra.ocultarColocacion(); },
  actualizar(ctx, t, tl) {
    const o = ctx.obra;
    o.nivel(57.0);
    for (const k in o.fantasmas) o.fantasmas[k].visible = false;
    o.tColoc0 = 47.3;
    const cx = -46;
    let k = o.convoyes(t, ctx.multitud, { velocidad: 0.6, cuantos: 6, plataforma: 0, retorno: 0 });
    k = o.colocacion(t, ctx.multitud, k, { cx });
    const b = o.bloqueColoc.position;
    const f = smooth(clamp(tl / 3));
    // vista lateral baja: el bloque entra en su hueco; las palancas y los obreros detrás
    const pos = V(cx + 4.6 - f * 0.6, o.h + 3.3 - f * 0.3, b.z - 7.8 + f * 0.6);
    const mira = V(cx - 0.1, o.h + 0.5, b.z - 2.2);
    camara(ctx, pos, mira, { fov: 46, cerca: 0.1, mano: 0.02, t });
    ctx.mundo.enfocarSombra(V(cx, o.h, b.z), 14);
    const foco = pos.distanceTo(b);
    return { apertura: 0.7, foco, maxDesenfoque: 14, bloom: 0.28, rayos: 0.4 };
  },
};

export const plano6c = {
  id: '6c', inicio: 50.3, fin: 56.0,
  preparar(ctx) { obra(ctx); },
  activar(ctx) { comunActivar(ctx); },
  desactivar(ctx) {
    ctx.obra.visible(false);
    for (const k in ctx.obra.fantasmas) ctx.obra.fantasmas[k].visible = false;
    ctx.obra.rampas.matAdobe.opacity = 1; ctx.obra.rampas.matAdobe.transparent = false; ctx.obra.rampas.recta.castShadow = true;
  },
  actualizar(ctx, t, tl) {
    const o = ctx.obra;
    o.nivel(66.4);
    o.ocultarColocacion();
    // fases: real → recta → zigzag → espiral → real
    const fases = [['recta', 50.7, 52.3], ['zigzag', 52.3, 53.9], ['espiral', 53.9, 55.5]];
    const enHip = t > 50.6 && t < 55.6;
    const am = enHip ? 0.12 : 1;
    o.rampas.matAdobe.transparent = am < 1; o.rampas.matAdobe.opacity = am;
    o.rampas.matAdobe.depthWrite = am >= 1;
    o.rampas.recta.castShadow = am >= 1;
    for (const [nom, a, b] of fases) {
      const fz = o.fantasmas[nom];
      const v = Math.min(clamp((t - a) / 0.25), clamp((b - t) / 0.25));
      fz.visible = v > 0;
      const pulso = 0.85 + 0.15 * Math.sin(t * 9);
      fz.userData.mat.opacity = 0.32 * v * pulso; fz.userData.matLin.opacity = 0.9 * v;
    }
    o.convoyes(t, ctx.multitud, { velocidad: 1.6, cuantos: enHip ? 0 : 16, retorno: enHip ? 0 : 40, plataforma: enHip ? 0 : 18 });
    // desde el sur, alto: la rampa se aleja en profundidad hacia la pirámide
    const f = easeInOut(clamp(tl / 5.7));
    const pos = V(70 + 30 * f, 190 + 90 * f, 640 + 260 * f);
    camara(ctx, pos, V(-12, 36, 150 - 30 * f), { fov: 44, cerca: 2, mano: 0.3, t });
    ctx.mundo.enfocarSombra(V(-10, 30, 250), 380);
    return { bloom: enHip ? 0.55 : 0.3, rayos: 0.5, saturacion: enHip ? 0.85 : 1.05 };
  },
  overlay(g, t) {
    rotuloHipotesis(g, '¿RAMPA RECTA?', t, 50.75, 52.3, { y: 760 });
    rotuloHipotesis(g, '¿EN ZIGZAG?', t, 52.35, 53.9, { y: 760 });
    rotuloHipotesis(g, '¿EN ESPIRAL?', t, 53.95, 55.5, { y: 760 });
  },
};
