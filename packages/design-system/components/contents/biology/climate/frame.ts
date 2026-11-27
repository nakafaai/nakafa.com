import { BUDGET } from "@repo/design-system/components/contents/biology/climate/budget";
import { Array as Arr, Schema } from "effect";

/** The tub is empty at 250 ppm and full to its lip at 600 ppm. */
const TANK = { empty: 250, full: 600 } as const;

const PointSchema = Schema.Tuple([Schema.Finite, Schema.Finite]);
export type Point = typeof PointSchema.Type;

const SideSchema = Schema.Literals(["left", "right"]);
type Side = typeof SideSchema.Type;

const SizeSchema = Schema.Struct({
  height: Schema.Finite,
  width: Schema.Finite,
});

/**
 * Where the bathtub and its fittings stand in a sketch of `size`, in pixels.
 * It is a deep enamelled soaking tub seen in cutaway, its near wall taken off
 * so the water shows against the glazed back wall: a rolled rim, a bowl that
 * curves into the floor, short chrome feet, a floor-standing gooseneck filler
 * on the left and an exposed chrome waste under the floor on the right. It
 * stands in the middle of the sketch, across 44% of its width.
 */
export function frameOf(size: typeof SizeSchema.Type) {
  const { height, width } = size;
  const left = width * 0.28;
  const right = width * 0.72;
  const base = height * 0.79;
  const plug = right - width * 0.1;
  const bend = width * 0.012;
  const drop = base + height * 0.022;
  const outlet: Point = [
    plug - width * 0.032,
    drop + bend * 2 + height * 0.018,
  ];
  return {
    base,
    bend,
    bottom: height * 0.76,
    column: left - width * 0.02,
    drop,
    ground: height * 0.92,
    height,
    left,
    nozzle: height * 0.13,
    outlet,
    plug,
    right,
    rim: height * 0.2,
    spout: left + width * 0.075,
    top: height * 0.235,
    unit: width / 720,
    wall: width * 0.009,
    width,
  };
}
export type Frame = ReturnType<typeof frameOf>;

/** The height of the water's surface at a CO2 `level` in ppm, held between the floor and the lip. */
export function surfaceOf(frame: Frame, level: number) {
  const share = clamp((level - TANK.empty) / (TANK.full - TANK.empty));
  return frame.bottom - (frame.bottom - frame.top) * share;
}

/** The x of the glazed inside wall at height `y`: steep under the rim, curving into the floor. */
export function insideAt(frame: Frame, y: number, side: Side) {
  const bowl = clamp((y - frame.top) / (frame.bottom - frame.top)) ** 4;
  return side === "left"
    ? frame.left + frame.wall + bowl * frame.width * 0.045
    : frame.right - frame.wall - bowl * frame.width * 0.028;
}

/** The x of the tub's outside at height `y`, a wall's thickness outside the glaze. */
export function outsideAt(frame: Frame, y: number, side: Side) {
  const bowl = clamp((y - frame.top) / (frame.base - frame.top)) ** 4;
  return side === "left"
    ? frame.left + bowl * frame.width * 0.042
    : frame.right - bowl * frame.width * 0.026;
}

/** A closed outline from `from` down to `to`: down the left wall, then up the right. */
export function outline(
  from: number,
  to: number,
  edge: (y: number, side: Side) => number
) {
  const steps = 28;
  const heights = Arr.map(
    Arr.range(0, steps),
    (step) => from + ((to - from) * step) / steps
  );
  return Arr.appendAll(
    Arr.map(heights, (y): Point => [edge(y, "left"), y]),
    Arr.map(Arr.reverse(heights), (y): Point => [edge(y, "right"), y])
  );
}

/** The bathwater's outline from its surface down to the floor of the tub. */
export function waterOf(frame: Frame, surface: number) {
  return outline(surface, frame.bottom, (y, side) => insideAt(frame, y, side));
}

/** The height the dashed line marks across the tub: the CO2 level before industry. */
export function markOf(frame: Frame) {
  return surfaceOf(frame, BUDGET.preindustrial);
}

/** Holds a share to [0, 1]. */
function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}
