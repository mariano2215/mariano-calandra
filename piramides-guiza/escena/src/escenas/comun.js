// Recursos compartidos entre planos y ayudas de cámara/atmósfera.
import * as THREE from 'three';
import { Obra } from '../obra.js';
import { Piramide } from '../piramide.js';
import { temblor } from '../util.js';

export function obra(ctx) {
  if (!ctx.obra) { ctx.obra = new Obra(ctx.mundo); ctx.obra.tColoc0 = 0; ctx.obra.visible(false); }
  return ctx.obra;
}

// Pirámides actuales (Keops erosionada sin revestimiento, Kefrén y Micerino)
export function actuales(ctx) {
  if (ctx.actuales) return ctx.actuales;
  const g = new THREE.Group();
  const keops = new Piramide({ seed: 5, tono: 0.9, erosion: 0.8 });
  keops.nivel(138);
  const kefren = new Piramide({ H: 143.5, S: 107.6, n: 140, seed: 8, tono: 0.95, erosion: 0.6, posicion: new THREE.Vector3(-260, 9, 390) });
  kefren.nivel(140);
  const micerino = new Piramide({ H: 65, S: 51.6, n: 62, seed: 11, tono: 0.85, erosion: 0.7, posicion: new THREE.Vector3(-520, 4, 880) });
  micerino.nivel(62);
  g.add(keops.grupo, kefren.grupo, micerino.grupo);
  // revestimiento conservado cerca de la cima de Kefrén
  const cap = new THREE.Mesh(new THREE.ConeGeometry(107.6 * 0.24 * Math.SQRT2, 143.5 * 0.24, 4, 1),
    new THREE.MeshStandardMaterial({ color: 0xd9c7a6, roughness: 0.7 }));
  cap.rotation.y = Math.PI / 4; cap.position.set(-260, 9 + 143.5 * (1 - 0.24 / 2) + 0.4, 390); cap.castShadow = true;
  g.add(cap);
  g.visible = false;
  ctx.mundo.escena.add(g);
  ctx.actuales = { grupo: g, keops, kefren, micerino };
  return ctx.actuales;
}

export function camara(ctx, pos, mira, { fov = 50, cerca = 0.5, lejos = 30000, mano = 0, t = 0, roll = 0 } = {}) {
  const c = ctx.camara;
  c.fov = fov; c.near = cerca; c.far = lejos; c.updateProjectionMatrix();
  const p = pos.clone();
  if (mano > 0) p.add(temblor(t, mano, 3));
  c.position.copy(p);
  c.up.set(0, 1, 0);
  c.lookAt(mira);
  if (roll) c.rotateZ(roll);
  c.updateMatrixWorld();
}

// Presets de luz (azimut desde el sur hacia el este; negativo = oeste)
export const PRESETS = {
  amanecer: { elev: 6, azim: 100, exposicion: 0.95, cenit: 0x4a6aa8, horizonte: 0xf2b98a, bajo: 0xb98c66, densidad: 0.00030,
    solColor: 0xffb47a, solInt: 3.4, cieloHemi: 0x9fb4dc, sueloHemi: 0xb08560, hemiInt: 0.9, halo: 1.3, nubes: 0.45 },
  manana: { elev: 32, azim: 62, exposicion: 0.85, cenit: 0x3f72c0, horizonte: 0xe7d8bf, bajo: 0xcdb08a, densidad: 0.00020,
    solColor: 0xffe6c2, solInt: 3.8, cieloHemi: 0xb5cdf0, sueloHemi: 0xc49c70, hemiInt: 1.15, halo: 0.8, nubes: 0.35 },
  mediodia: { elev: 58, azim: 15, exposicion: 0.78, cenit: 0x3a74c8, horizonte: 0xe9e0cf, bajo: 0xd2b893, densidad: 0.00018,
    solColor: 0xfff2dc, solInt: 4.0, cieloHemi: 0xbdd5f2, sueloHemi: 0xcaa67c, hemiInt: 1.25, halo: 0.6, nubes: 0.25 },
  tarde: { elev: 24, azim: -52, exposicion: 0.9, cenit: 0x416fb4, horizonte: 0xf0cfa2, bajo: 0xc69c70, densidad: 0.00022,
    solColor: 0xffd6a0, solInt: 3.7, cieloHemi: 0xadc4e8, sueloHemi: 0xbf9268, hemiInt: 1.05, halo: 1.0, nubes: 0.4 },
  ocaso: { elev: 6, azim: -64, exposicion: 1.3, cenit: 0x3a4f8c, horizonte: 0xf2a070, bajo: 0xa8744e, densidad: 0.00028,
    solColor: 0xffa868, solInt: 4.2, cieloHemi: 0x8f9fcb, sueloHemi: 0xa0704a, hemiInt: 1.0, halo: 1.5, nubes: 0.55 },
  crepusculo: { elev: -1.5, azim: -66, exposicion: 1.3, cenit: 0x24306a, horizonte: 0xd07a58, bajo: 0x5a4038, densidad: 0.00022,
    solColor: 0xff8a50, solInt: 0.35, cieloHemi: 0x6878b0, sueloHemi: 0x4a3830, hemiInt: 1.0, halo: 1.2, nubes: 0.5 },
};

export function mezclaPreset(a, b, f) {
  const o = {};
  for (const k in a) {
    if (['cenit', 'horizonte', 'bajo', 'niebla', 'solColor', 'cieloHemi', 'sueloHemi'].includes(k)) {
      o[k] = new THREE.Color(a[k]).lerp(new THREE.Color(b[k]), f).getHex();
    } else o[k] = a[k] + (b[k] - a[k]) * f;
  }
  return o;
}
