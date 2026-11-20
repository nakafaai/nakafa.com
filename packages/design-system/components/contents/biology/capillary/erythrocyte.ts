import { Array as Arr } from "effect";

/**
 * The red cell's shape, at rest and squeezed into a capillary, in
 * micrometres.
 */

/**
 * The resting red cell of Evans and Fung, "Improved measurements of the
 * erythrocyte geometry", Microvascular Research 4, 1972, 335-347: its radius
 * and the coefficients of its thickness profile, in micrometres. The disc is
 * 7.82 micrometres across, 0.81 thick at its centre and about 2.57 at its
 * rim, and holds about 94 cubic micrometres.
 */
export const ERYTHROCYTE = { c0: 0.81, c2: 7.83, c4: -4.39, radius: 3.91 };

/**
 * The red cell's full thickness at a distance `r` from its axis, in
 * micrometres (Evans and Fung, 1972): the square root closes the rim and the
 * polynomial dimples the centre.
 */
export function erythrocyteThickness(r: number) {
  const x = Math.min(1, r / ERYTHROCYTE.radius);
  return (
    Math.sqrt(1 - x * x) *
    (ERYTHROCYTE.c0 + ERYTHROCYTE.c2 * x ** 2 + ERYTHROCYTE.c4 * x ** 4)
  );
}

/**
 * The red cell's outline from the centre of one face round the rim to the
 * centre of the other, in micrometres, as [radius, height] pairs for a lathe.
 * The samples crowd toward the rim, where the outline turns fastest.
 *
 * @param fit - The widest the cell may be, as when it squeezes into a
 * capillary; the rim then folds back by as much as keeps the membrane's
 * width, into the parachute shape red cells take in a capillary (Skalak and
 * Brånemark, "Deformation of red blood cells in capillaries", Science 164,
 * 1969, 717-719).
 */
export function erythrocyteOutline(samples: number, fit = ERYTHROCYTE.radius) {
  const squeeze = Math.min(1, fit / ERYTHROCYTE.radius);
  const fold = Math.sqrt(Math.max(0, ERYTHROCYTE.radius ** 2 - fit ** 2));
  const face = (side: 1 | -1) =>
    Arr.map(Arr.range(0, samples), (step) => {
      const r = ERYTHROCYTE.radius * Math.sin((step / samples) * (Math.PI / 2));
      const share = r / ERYTHROCYTE.radius;
      const height = (side * erythrocyteThickness(r)) / 2;
      return [r * squeeze, height - fold * share ** 2] as const;
    });
  return [...face(-1), ...Arr.reverse(face(1))];
}
