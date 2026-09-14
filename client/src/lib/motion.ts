import { Target, TargetAndTransition, Transition } from "framer-motion";

/**
 * Presets de animación, centralizados.
 *
 * Las animaciones de entrada y salida están desactivadas a propósito: en los
 * equipos donde corre esto (celulares y terminales del local) cada apertura de
 * ventana se sentía trabada, y el efecto era puramente estético. Ahora todo
 * aparece de una. Se mantiene la forma de los presets para no tener que tocar
 * las decenas de pantallas que los usan: siguen siendo válidos, pero no animan.
 *
 * Si alguna vez se quieren devolver, alcanza con reponer las duraciones acá:
 * el resto de la app no necesita cambios.
 */

const INSTANTANEO = { duration: 0 } as Transition;

export const TRANSITIONS = {
  snappy: INSTANTANEO,
  fade: INSTANTANEO,
  spring: INSTANTANEO,
};

export const ANIMATIONS = {
  // El feedback al tocar sí se mantiene: es lo que confirma que el botón
  // recibió el toque, y no tiene nada que ver con la demora al abrir ventanas.
  tap: { scale: 0.98 } as Target,
  hover: { scale: 1.02 } as Target,
  fadeIn: {
    initial: false,
    animate: {} as TargetAndTransition,
    transition: INSTANTANEO,
  },
  fadeInUp: {
    initial: false,
    animate: {} as TargetAndTransition,
    transition: INSTANTANEO,
  },
  scaleIn: {
    initial: false,
    animate: {} as TargetAndTransition,
    transition: INSTANTANEO,
  }
};
