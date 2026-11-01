// ESCENA 7 — EL RESULTADO (56–70 s): time-lapse final, colocación del piramidión, alisado del
// revestimiento de caliza blanca de arriba hacia abajo mientras se desmonta la rampa; atardecer;
// transición a la Guiza actual (sin revestimiento, con Kefrén, Micerino y la ciudad).
import * as THREE from 'three';
import { obra, actuales, camara, PRESETS, mezclaPreset } from './comun.js';
import { Pista, V, clamp, smooth, easeInOut, easeOut } from '../util.js';
import { tituloCine } from '../texto.js';
import { semi, ALTURA } from '../piramide.js';

// cámara única (continua entre los tres planos) desde el sureste
const cam7 = new Pista([
  [56.0, V(250, 95, 420)],
  [61.6, V(380, 92, 640)],
  [66.3, V(560, 110, 1000)],
  [70.0, V(660, 120, 1160)],
]);
const mira7 = new Pista([
  [56.0, V(0, 92, 0)],
  [61.6, V(-20, 70, 20)],
  [66.3, V(-110, 55, 170)],
  [70.0, V(-150, 52, 210)],
]);

const nivel7 = (t) => 70 + (146 - 70) * smooth(clamp((t - 56.0) / 4.0));
const revest7 = (t) => easeInOut(clamp((t - 59.8) / 3.6));

function antigua(ctx, t) {
  const o = ctx.obra;
  o.visible(true);
  ctx.mundo.epoca('antigua');
  for (const k in o.fantasmas) o.fantasmas[k].visible = false;
  o.ocultarColocacion();
  const n = nivel7(t);
  const fr = revest7(t);
  // la rampa se desmonta a medida que el revestimiento baja (alisado de arriba hacia abajo)
  const hRampa = Math.min(n, ALTURA * (1 - fr) - 2);
  o.nivel(n, { rampa: hRampa > 3 });
  if (hRampa > 3 && n > 140) { o.rampas.ajustar(hRampa); }
  o.revestir(fr);
  o.planoTope.constant = ALTURA + 5;
  let k = 0;
  if (o.rampas.recta.visible) k = o.convoyes(t * (t < 60 ? 6 : 1), ctx.multitud, { velocidad: 0.6, cuantos: Math.round(16 * (1 - fr)), retorno: Math.round(40 * (1 - fr)), plataforma: t < 60 ? 18 : 0 });
  void k;
}

export const plano7a = {
  id: '7a', inicio: 56.0, fin: 61.6,
  preparar(ctx) { obra(ctx); actuales(ctx); },
  activar(ctx) {},
  desactivar(ctx) { ctx.obra.visible(false); ctx.obra.revestir(0); },
  actualizar(ctx, t) {
    antigua(ctx, t);
    ctx.mundo.atmosfera(mezclaPreset(PRESETS.tarde, PRESETS.ocaso, smooth(clamp((t - 56) / 5.6)) * 0.8));
    camara(ctx, cam7.valor(t), mira7.valor(t), { fov: 44, cerca: 2, mano: 0.4, t });
    ctx.mundo.enfocarSombra(V(0, 50, 100), 420);
    return { bloom: 0.4, rayos: 0.8, contraste: 1.07 };
  },
};

export const plano7b = {
  id: '7b', inicio: 61.6, fin: 66.3,
  preparar(ctx) { obra(ctx); },
  activar(ctx) {},
  desactivar(ctx) { ctx.obra.visible(false); ctx.obra.revestir(0); },
  actualizar(ctx, t) {
    antigua(ctx, t);
    ctx.mundo.atmosfera(mezclaPreset(PRESETS.tarde, PRESETS.ocaso, 0.8 + 0.2 * smooth(clamp((t - 61.6) / 4.7))));
    camara(ctx, cam7.valor(t), mira7.valor(t), { fov: 44, cerca: 2, mano: 0.35, t });
    ctx.mundo.enfocarSombra(V(0, 50, 100), 420);
    return { bloom: 0.5, rayos: 1.0, contraste: 1.08 };
  },
};

export const plano7c = {
  id: '7c', inicio: 66.3, fin: 70.0,
  preparar(ctx) { actuales(ctx); },
  activar(ctx) { ctx.actuales.grupo.visible = true; ctx.mundo.epoca('actual'); },
  desactivar(ctx) { ctx.actuales.grupo.visible = false; ctx.mundo.matCiudad.emissiveIntensity = 0; ctx.mundo.grupos.ciudadSE.visible = false; },
  actualizar(ctx, t) {
    ctx.actuales.grupo.visible = true;
    ctx.mundo.epoca('actual');
    ctx.mundo.grupos.ciudadSE.visible = true;
    const f = smooth(clamp((t - 66.3) / 3.0));
    ctx.mundo.atmosfera(mezclaPreset(PRESETS.ocaso, PRESETS.crepusculo, f * 0.85));
    ctx.mundo.matCiudad.emissiveIntensity = 0.3 + f * 2.2;
    camara(ctx, cam7.valor(t), mira7.valor(t), { fov: 44, cerca: 2, mano: 0.3, t });
    ctx.mundo.enfocarSombra(V(-150, 50, 300), 650);
    const negro = smooth(clamp((t - 69.45) / 0.55));
    return { bloom: 0.6, rayos: 0.8, contraste: 1.08, negro };
  },
  overlay(g, t) {
    tituloCine(g, ['4.500 AÑOS', 'DESPUÉS…'], t, 66.7, 70.2, { y: 470, tam: 104 });
    tituloCine(g, ['SIGUE ASOMBRANDO', 'AL MUNDO.'], t, 67.5, 70.2, { y: 760, tam: 80, color: '#FFF4DE' });
  },
};
