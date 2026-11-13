import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr, Schema } from "effect";

/**
 * Rhizopus mould growing over cooked soybeans into tempeh, in a 30 mm square
 * of the tray. Tempeh makers keep the beans at about 30 °C for 24 to 48 hours
 * (Nout and Kiers, Journal of Applied Microbiology 98, 2005). The card's tips
 * grow 1 mm an hour and branch about every 2 mm, round values in the range
 * reported for fast Rhizopus colonies.
 */
export const TEMPEH = {
  branchEvery: 2,
  hours: 36,
  size: 30,
  speed: 1,
  tips: 360,
} as const;

/** One growing hyphal tip, in millimetres from the tray's middle. */
export const TipSchema = Schema.Struct({
  heading: Schema.Finite,
  id: Schema.Finite,
  travelled: Schema.Finite,
  x: Schema.Finite,
  y: Schema.Finite,
});
export type Tip = typeof TipSchema.Type;

/** One stretch of hypha a tip laid down. */
export const SegmentSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);
export type Segment = typeof SegmentSchema.Type;

/** The spores sown on the beans: `count` of them at seeded spots, each one tip. */
export function sporesOf(count: number): readonly Tip[] {
  return Arr.map(Arr.range(0, count - 1), (id) => ({
    heading: hashUnit(id, 7) * Math.PI * 2,
    id,
    travelled: 0,
    x: (hashUnit(id, 5) - 0.5) * TEMPEH.size * 0.8,
    y: (hashUnit(id, 6) - 0.5) * TEMPEH.size * 0.8,
  }));
}

/**
 * Grows every tip for `hours`: each moves on, wanders a little, turns back
 * from the tray's edge, and, once it has grown another `branchEvery`, starts
 * a branch at an angle, until the tray holds `TEMPEH.tips` tips. Returns the
 * new tips and the segments they drew.
 */
export function growOf(tips: readonly Tip[], hours: number, salt: number) {
  const half = TEMPEH.size / 2;
  const grown = Arr.map(tips, (tip) => {
    const wander = (hashUnit(tip.id * 13 + salt, tip.travelled) - 0.5) * 0.5;
    const inward =
      Math.abs(tip.x) > half * 0.92 || Math.abs(tip.y) > half * 0.92;
    const heading = inward ? Math.atan2(-tip.y, -tip.x) : tip.heading + wander;
    const step = TEMPEH.speed * hours;
    return {
      heading,
      id: tip.id,
      travelled: tip.travelled + step,
      x: Math.max(-half, Math.min(half, tip.x + Math.cos(heading) * step)),
      y: Math.max(-half, Math.min(half, tip.y + Math.sin(heading) * step)),
    };
  });
  const segments = Arr.map(
    Arr.zip(tips, grown),
    ([from, to]): Segment => [from.x, from.y, to.x, to.y]
  );
  const room = TEMPEH.tips - grown.length;
  const branching = Arr.map(
    Arr.filter(
      Arr.zip(tips, grown),
      ([before, after]) =>
        Math.floor(after.travelled / TEMPEH.branchEvery) >
        Math.floor(before.travelled / TEMPEH.branchEvery)
    ),
    ([, after]) => after
  );
  const branches = Arr.map(
    Arr.take(branching, Math.max(0, room)),
    (tip, index) => ({
      heading:
        tip.heading + (hashUnit(tip.id, index + salt) < 0.5 ? -1 : 1) * 0.9,
      id: grown.length + index + salt * 1000,
      travelled: tip.travelled,
      x: tip.x,
      y: tip.y,
    })
  );
  return { segments, tips: Arr.appendAll(grown, branches) };
}

/** The length of hypha in a set of segments, in millimetres. */
export function lengthOf(segments: readonly Segment[]) {
  return Arr.reduce(
    segments,
    0,
    (sum, [x0, y0, x1, y1]) => sum + Math.hypot(x1 - x0, y1 - y0)
  );
}

/** The tray split into `cells` × `cells` squares, as the share each segment end has reached. */
export function coverOf(segments: readonly Segment[], cells: number) {
  const half = TEMPEH.size / 2;
  const reached = Arr.dedupe(
    Arr.map(segments, ([, , x, y]) => {
      const column = Math.min(
        cells - 1,
        Math.floor(((x + half) / TEMPEH.size) * cells)
      );
      const row = Math.min(
        cells - 1,
        Math.floor(((y + half) / TEMPEH.size) * cells)
      );
      return row * cells + column;
    })
  );
  return reached.length / (cells * cells);
}
