/**
 * Significant figures of a measured value: the digits a reading supports,
 * and the same value in scientific notation, a coefficient from 1 to below
 * 10 with exactly that many digits times a power of ten.
 */

/**
 * The value in scientific notation with `figures` significant figures: the
 * coefficient, already rounded, and the exponent of ten. A coefficient that
 * rounds up to 10 moves one power over, so it always stays below 10.
 */
export function scientific(value: number, figures: number) {
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const scale = 10 ** (figures - 1);
  const coefficient = Math.round((value / 10 ** exponent) * scale) / scale;
  return Math.abs(coefficient) >= 10
    ? { coefficient: coefficient / 10, exponent: exponent + 1 }
    : { coefficient, exponent };
}

/**
 * How many significant figures a reading carries when it is resolved to
 * `resolution`: the digits from its first nonzero digit down to the last
 * place the instrument resolves.
 */
export function readingFigures(value: number, resolution: number) {
  const first = Math.floor(Math.log10(Math.abs(value)));
  const last = Math.round(Math.log10(resolution));
  return first - last + 1;
}

/** The value rounded to the nearest step the instrument resolves. */
export function resolve(value: number, resolution: number) {
  const steps = Math.round(value / resolution);
  return resolution >= 1 ? steps * resolution : steps / Math.round(1 / resolution);
}
