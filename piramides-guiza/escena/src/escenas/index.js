// Lista ordenada de planos y transiciones entre ellos.
import { plano1 } from './escena1.js';
import { plano2, plano3 } from './escena2y3.js';
import { plano4a, plano4b, plano4c } from './escena4.js';
import { plano5a, plano5a2, plano5b } from './escena5.js';
import { plano6a, plano6b, plano6c } from './escena6.js';
import { plano7a, plano7b, plano7c } from './escena7.js';

export const ESCENAS = [plano1, plano2, plano3, plano4a, plano4b, plano4c, plano5a, plano5a2, plano5b, plano6a, plano6b, plano6c, plano7a, plano7b, plano7c];

// Fundidos (dur en s, centrados en el corte). El resto son cortes directos al ritmo de la música.
export const TRANSICIONES = [
  { t: 13.0, dur: 0.5, tipo: 'fundido' },
  { t: 22.0, dur: 0.6, tipo: 'fundido' },
  { t: 25.2, dur: 0.4, tipo: 'fundido' },
  { t: 28.6, dur: 0.4, tipo: 'fundido' },
  { t: 32.0, dur: 0.6, tipo: 'fundido' },
  { t: 34.7, dur: 0.4, tipo: 'fundido' },
  { t: 36.4, dur: 0.4, tipo: 'fundido' },
  { t: 43.0, dur: 0.6, tipo: 'fundido' },
  { t: 47.3, dur: 0.4, tipo: 'fundido' },
  { t: 50.3, dur: 0.4, tipo: 'fundido' },
  { t: 56.0, dur: 0.6, tipo: 'fundido' },
  { t: 66.3, dur: 1.0, tipo: 'fundido' },
];
