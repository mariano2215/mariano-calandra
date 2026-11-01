// ESCENA 1 — EL MISTERIO (0–5 s): sobrevuelo actual de Guiza hacia la cima de Keops;
// a los 3,3 s, "rebobinado" temporal: reaparece el revestimiento y la pirámide se desarma
// hasta quedar en construcción, con un contador de años 2026 d. C. → 2560 a. C.
import * as THREE from 'three';
import { obra, actuales, camara, PRESETS, mezclaPreset } from './comun.js';
import { Pista, V, clamp, inv, easeInOut, easeIn, easeOut } from '../util.js';
import { tituloCine, contadorAnios } from '../texto.js';

const T_REB = 3.3; // inicio del rebobinado

const ruta = new Pista([
  [0.0, V(560, 70, 1240)],
  [1.6, V(340, 100, 700)],
  [3.3, V(150, 150, 300)],
  [5.0, V(80, 180, 250)],
]);
const mira = new Pista([
  [0.0, V(-80, 60, 120)],
  [2.0, V(-10, 105, 30)],
  [3.3, V(0, 128, 0)],
  [5.0, V(0, 92, 10)],
]);

export const plano1 = {
  id: '1', inicio: 0, fin: 5.0,
  preparar(ctx) { obra(ctx); actuales(ctx); },
  activar(ctx) {},
  desactivar(ctx) { ctx.actuales.grupo.visible = false; ctx.obra.visible(false); ctx.obra.revestir(0); },
  actualizar(ctx, t, tl) {
    const A = ctx.actuales, o = ctx.obra;
    const reb = t >= T_REB;
    ctx.mundo.epoca(t < T_REB + 0.12 ? 'actual' : 'antigua');
    // luz: tarde actual → mañana antigua durante el rebobinado
    const fLuz = easeInOut(clamp((t - T_REB) / 1.5));
    ctx.mundo.atmosfera(mezclaPreset(PRESETS.tarde, PRESETS.manana, fLuz));
    A.grupo.visible = !reb || t < T_REB + 0.12;
    o.visible(reb && t >= T_REB + 0.12);
    if (o.grupo.visible) {
      A.grupo.visible = false;
      // 0,12–0,6 s: pirámide completa con revestimiento; luego se desarma de arriba hacia abajo
      const fDes = easeIn(clamp((t - (T_REB + 0.55)) / 1.15));
      const n = 146 - fDes * (146 - 62);
      o.nivel(n, { rampa: n < 112 });
      o.revestir(1 - clamp((t - (T_REB + 0.9)) / 0.6));
      o.ocultarColocacion();
      for (const k in o.fantasmas) o.fantasmas[k].visible = false;
      if (n < 112) o.convoyes(t, ctx.multitud, { velocidad: 9, cuantos: Math.round(clamp((140 - n) / 40) * 16) });
    }
    const pos = ruta.valor(t), m = mira.valor(t);
    // sacudida breve en el golpe del rebobinado
    const golpe = Math.exp(-Math.max(0, t - T_REB) * 6) * (reb ? 1 : 0);
    camara(ctx, pos, m, { fov: 48 + golpe * 6, cerca: 2, mano: 0.6 + golpe * 3, t, roll: Math.sin(t * 0.7) * 0.02 });
    ctx.mundo.enfocarSombra(V(-60, 40, 120), 520);
    const flash = reb ? Math.exp(-(t - T_REB) * 7) * 0.85 : 0;
    return { bloom: 0.35 + flash * 0.6, rayos: 0.7, flash, sepia: reb ? 0.25 * Math.exp(-(t - T_REB) * 1.2) : 0, contraste: 1.08 };
  },
  overlay(g, t) {
    tituloCine(g, ['¿CÓMO LO', 'HICIERON?'], t, 0.15, 3.25, { y: 520, tam: 124 });
    contadorAnios(g, t, T_REB + 0.05, 5.6, 2026, -2560, { y: 560 });
  },
};
