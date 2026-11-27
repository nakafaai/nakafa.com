import type { Segment } from "@repo/design-system/components/contents/biology/hyphae/growth";
import { TEMPEH } from "@repo/design-system/components/contents/biology/hyphae/growth";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr, Order, Result } from "effect";

/**
 * The tray of split soybeans the mould grows over, in millimetres from the
 * tray's middle: where each bean half lies, how high the beans stand under
 * any place, and where each stretch of hypha and each spore stalk goes once
 * it is draped over them.
 */

/** A split cooked soybean half: half its length, its width and its thickness. */
export const BEAN = { high: 1.5, long: 2.7, wide: 2.1 } as const;

/** The beans lie in rows across the tray, as a maker spreads them one layer deep. */
const ROWS = { columns: 5, rows: 6 } as const;

/** How far above the beans a thread lies: its own radius and a little air. */
const THREAD_LIFT = 0.06;

/** How thick one hypha is drawn, a little thicker than life so it reads at the size of the card. */
export const THREAD_RADIUS = 0.045;

/** How many hours after a stretch of hypha is laid it can first raise a spore stalk. */
const STALK_AGE = 14;

/** The share of stretches of hypha that raise a spore stalk. */
const STALK_SHARE = 0.012;

/** The shortest a stretch of hypha counts as, so one that did not move still has a direction. */
const TINY = 1e-6;

/**
 * The bean halves on the tray: each with its middle, how far it is turned,
 * and whether it lies with its rounded back up or its flat split face up.
 */
export function beansOf() {
  return Arr.makeBy(ROWS.columns * ROWS.rows, (bean) => {
    const column = bean % ROWS.columns;
    const row = Math.floor(bean / ROWS.columns);
    return {
      domed: hashUnit(bean, 4) < 0.62,
      turn: (hashUnit(bean, 3) - 0.5) * 0.5 + (bean % 2) * Math.PI,
      x:
        -TEMPEH.size / 2 +
        ((column + 0.5) * TEMPEH.size) / ROWS.columns +
        (hashUnit(bean, 1) - 0.5) * 0.4,
      y:
        -TEMPEH.size / 2 +
        ((row + 0.5) * TEMPEH.size) / ROWS.rows +
        (hashUnit(bean, 2) - 0.5) * 0.3,
    };
  });
}

type Bean = ReturnType<typeof beansOf>[number];

/**
 * Sculpts one point of a unit ball into a bean half lying on its split
 * face: the upper half stays a rounded back, the lower half is pressed up
 * into the slightly hollow split face, and the whole is bent into the
 * kidney outline of a soybean and sized to a real half.
 *
 * @returns The point of the bean, across, up and toward the reader, in millimetres
 */
export function beanPoint(x: number, y: number, z: number) {
  const up = y < 0 ? 0.07 * y * y : y;
  const bend = 0.16 * (x * x - 0.45);
  return [x * BEAN.long, up * BEAN.high, (z + bend) * BEAN.wide] as const;
}

/** How high one bean stands under a place, or nothing where the place is beside it. */
function beanHeight(bean: Bean, x: number, y: number) {
  const dx = x - bean.x;
  const dy = y - bean.y;
  const along =
    (dx * Math.cos(bean.turn) + dy * Math.sin(bean.turn)) / BEAN.long;
  const across =
    (dy * Math.cos(bean.turn) - dx * Math.sin(bean.turn)) / BEAN.wide;
  const inside = 1 - along * along - across * across;
  if (inside <= 0) {
    return 0;
  }
  return bean.domed
    ? BEAN.high * Math.sqrt(inside)
    : BEAN.high * (1 - 0.07 * inside);
}

/**
 * How high the beans stand under one place of the tray, in millimetres above
 * the leaf: the rounded back or the flat face of the bean there, or nothing
 * in a gap between beans.
 */
export function reliefAt(beans: readonly Bean[], x: number, y: number) {
  return Arr.reduce(beans, 0, (highest, bean) =>
    Math.max(highest, beanHeight(bean, x, y))
  );
}

/**
 * Where every stretch of hypha lies once it is draped over the beans, as the
 * sixteen numbers of one placement each, in the order the stretches were
 * laid: a thin tube from one end to the other, lifted onto whatever bean is
 * under each end. Drawing the first so many shows the mould at one hour.
 */
export function threadPlacements(
  segments: readonly Segment[],
  beans: readonly Bean[]
) {
  const placements = new Float32Array(segments.length * 16);
  Arr.forEach(segments, ([x0, y0, x1, y1], index) => {
    const fromUp = reliefAt(beans, x0, y0) + THREAD_LIFT;
    const toUp = reliefAt(beans, x1, y1) + THREAD_LIFT;
    const alongX = x1 - x0;
    const alongY = toUp - fromUp;
    const alongZ = y1 - y0;
    const length = Math.max(Math.hypot(alongX, alongY, alongZ), TINY);
    const level = Math.max(Math.hypot(alongX, alongZ), TINY);
    // The tube's own up runs along the stretch; its two sides are the level
    // direction across the stretch and the one square to both.
    const sideX = -alongZ / level;
    const sideZ = alongX / level;
    placements.set(
      [
        sideX * THREAD_RADIUS,
        0,
        sideZ * THREAD_RADIUS,
        0,
        alongX,
        alongY,
        alongZ,
        0,
        ((-sideZ * alongY) / length) * THREAD_RADIUS,
        ((sideZ * alongX - sideX * alongZ) / length) * THREAD_RADIUS,
        ((sideX * alongY) / length) * THREAD_RADIUS,
        0,
        (x0 + x1) / 2,
        (fromUp + toUp) / 2,
        (y0 + y1) / 2,
        1,
      ],
      index * 16
    );
  });
  return placements;
}

/**
 * The spore stalks the mould raises: a few stretches of hypha, once they
 * have aged, send up a sporangiophore with a round sporangium on its tip.
 * Each stalk has its foot, its height, how it leans, and the hour it
 * appears, and they come in the order they appear.
 *
 * @param segments - Every stretch of hypha, in the order they were laid
 * @param beans - The beans the mould grows over
 * @param hourOf - The hour at which the stretch at one place in the order was laid
 */
export function stalksOf(
  segments: readonly Segment[],
  beans: readonly Bean[],
  hourOf: (index: number) => number
) {
  const stalks = Arr.filterMap(segments, ([, , x, y], index) =>
    hashUnit(index, 31) < STALK_SHARE
      ? Result.succeed({
          appears: hourOf(index) + STALK_AGE + hashUnit(index, 37) * 6,
          foot: [x, reliefAt(beans, x, y) + THREAD_LIFT, y] as const,
          height: 1.1 + hashUnit(index, 41) * 1.3,
          lean: [
            (hashUnit(index, 43) - 0.5) * 0.5,
            (hashUnit(index, 47) - 0.5) * 0.5,
          ] as const,
        })
      : Result.failVoid
  );
  return Arr.sort(
    stalks,
    Order.mapInput(
      Order.Number,
      (stalk: (typeof stalks)[number]) => stalk.appears
    )
  );
}

/** How many of a run of things that appear in order have appeared by one hour. */
export function shownBy(appearances: readonly number[], hours: number) {
  return Arr.filter(appearances, (appears) => appears <= hours).length;
}
