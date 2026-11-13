import { Array as Arr, Option } from "effect";

/** Hydrogen's Rydberg constant, with the proton's recoil, in inverse metres (CODATA 2018). */
const RYDBERG = 10_967_758;

/** Hydrogen's ionisation energy in electronvolts, the depth of its ground state. */
const IONISATION = 13.6;

/** The speed of light in metres a second (exact, SI). */
const LIGHT = 299_792_458;

/** The share of 1 / n^2 two levels differ by, the bracket of the Rydberg formula. */
function levelGap(upper: number, lower: number) {
  return 1 / lower ** 2 - 1 / upper ** 2;
}

/**
 * The wavelength of the photon hydrogen gives off when its electron falls from
 * level `upper` to level `lower`, in nanometres, in vacuum, from the Rydberg
 * formula 1 / lambda = R_H (1 / n_1^2 - 1 / n_2^2).
 */
export function wavelength(upper: number, lower: number) {
  return 1e9 / (RYDBERG * levelGap(upper, lower));
}

/** The photon's energy in electronvolts: 13.6 eV (1 / n_1^2 - 1 / n_2^2). */
export function photonEnergy(upper: number, lower: number) {
  return IONISATION * levelGap(upper, lower);
}

/** The photon's frequency in hertz, c / lambda. */
export function frequency(upper: number, lower: number) {
  return LIGHT / (wavelength(upper, lower) * 1e-9);
}

/** The radius of Bohr orbit `level`, in Bohr radii: n^2. */
export function orbitRadius(level: number) {
  return level ** 2;
}

/**
 * The wavelength bands of the visible spectrum and the red, green and blue a
 * screen mixes for each, rising or falling linearly across the band (Dan
 * Bruton's approximation). Each channel is a pair: its value at the band's
 * start and at its end.
 */
const BANDS = [
  { blue: [1, 1], end: 440, green: [0, 0], red: [1, 0], start: 380 },
  { blue: [1, 1], end: 490, green: [0, 1], red: [0, 0], start: 440 },
  { blue: [1, 0], end: 510, green: [1, 1], red: [0, 0], start: 490 },
  { blue: [0, 0], end: 580, green: [1, 1], red: [0, 1], start: 510 },
  { blue: [0, 0], end: 645, green: [1, 0], red: [1, 1], start: 580 },
  { blue: [0, 0], end: 781, green: [0, 0], red: [1, 1], start: 645 },
] as const;

/** How bright the eye sees a wavelength, dimming toward both ends of the spectrum. */
function brightness(nanometres: number) {
  if (nanometres < 420) {
    return 0.3 + (0.7 * (nanometres - 380)) / 40;
  }
  if (nanometres > 700) {
    return 0.3 + (0.7 * (780 - nanometres)) / 80;
  }
  return 1;
}

/**
 * The color a wavelength looks, as red, green and blue from 0 to 1, or none
 * for ultraviolet and infrared light, which the eye cannot see.
 */
export function visibleColor(nanometres: number) {
  return Option.map(
    Arr.findFirst(
      BANDS,
      (band) => nanometres >= band.start && nanometres < band.end
    ),
    (band) => {
      const share = (nanometres - band.start) / (band.end - band.start);
      const mix = ([from, to]: readonly [number, number]) =>
        (from + (to - from) * share) * brightness(nanometres);
      return [mix(band.red), mix(band.green), mix(band.blue)] as const;
    }
  );
}
