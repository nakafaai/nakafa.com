import { Array as Arr, Order, Schema } from "effect";

/** The scale of one axis: its step, its ticks from 0, and its top. */
const AxisSchema = Schema.Struct({
  step: Schema.Finite,
  ticks: Schema.Array(Schema.Finite),
  top: Schema.Finite,
});
export type Axis = typeof AxisSchema.Type;

/** The axes of a distance-time graph: distance in kilometres and time in minutes. */
const AxesSchema = Schema.Struct({ km: AxisSchema, minute: AxisSchema });
export type Axes = typeof AxesSchema.Type;

/** The steps a graph's ticks may take within each power of ten, as a squared exercise book prints them. */
const STEPS = [1, 2, 5] as const;

/** How many steps an axis should have at least and at most, so it is neither bare nor crowded. */
const FEWEST = 3;
const MOST = 8;

/** How far a scale with too few or too many steps falls behind every scale that fits. */
const UNFIT = 100;

/**
 * The scale of one axis that must reach `most`, which is more than 0: a tidy
 * step of 1, 2 or 5 times a power of ten, the top of the axis at the first
 * whole step at or past `most`, and every tick from 0 to the top. Of the tidy
 * steps that give between three and eight steps, it takes the one nearest
 * `aim` steps, the larger on a tie, so a narrow card can ask for fewer
 * numbers.
 */
export function axisOf(most: number, aim: number): Axis {
  const power = 10 ** Math.floor(Math.log10(most));
  const scales = Arr.flatMap(
    [power / 10, power, power * 10] as const,
    (scale) =>
      Arr.map(STEPS, (step) => {
        const count = Math.ceil(most / (step * scale) - 1e-9);
        const fits = count >= FEWEST && count <= MOST;
        return {
          cost: Math.abs(count - aim) + (fits ? 0 : UNFIT),
          count,
          step: step * scale,
        };
      })
  );
  const chosen = Arr.headNonEmpty(
    Arr.sort(
      scales,
      Order.combine(
        Order.mapInput(
          Order.Number,
          (scale: (typeof scales)[number]) => scale.cost
        ),
        Order.mapInput(
          Order.flip(Order.Number),
          (scale: (typeof scales)[number]) => scale.step
        )
      )
    )
  );
  return {
    step: chosen.step,
    ticks: Arr.makeBy(chosen.count + 1, (index) => index * chosen.step),
    top: chosen.count * chosen.step,
  };
}
