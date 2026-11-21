// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  LEFT_ATRIUM,
  place,
  RIGHT_ATRIUM,
} from "@repo/design-system/components/contents/biology/heart/anatomy";
import {
  heartBeat,
  momentAt,
} from "@repo/design-system/components/contents/biology/heart/cycle";
import {
  advance,
  dropAt,
  forwardFlow,
  LEGS,
  laneOf,
  legRates,
  ROUTES,
} from "@repo/design-system/components/contents/biology/heart/flow";
import { Array as Arr } from "effect";

const beat = heartBeat(72, { endDiastolic: 120, endSystolic: 50 });
const forward = forwardFlow(beat);
const middle = { angle: 0, feed: 0, leave: 0, reach: 0, speed: 1 };

/** The last item of a list the test knows is not empty. */
function last<A>(items: readonly A[]) {
  return Arr.getUnsafe(items, items.length - 1);
}

/** Where a drop on the middle of its stream lies at `progress`. */
function centre(route: (typeof ROUTES)["venous"], progress: number) {
  const target = [0, 0, 0];
  dropAt(route, middle, progress, target);
  return target;
}

describe("the routes of the blood", () => {
  it("runs each route from the veins through its atrium and ventricle into its artery", () => {
    const rightPool = place(RIGHT_ATRIUM.along, RIGHT_ATRIUM.across, -0.6);
    const leftPool = place(LEFT_ATRIUM.along, LEFT_ATRIUM.across, -1.7);
    Arr.forEach(
      [
        [ROUTES.venous, rightPool],
        [ROUTES.arterial, leftPool],
      ] as const,
      ([route, pool]) => {
        Arr.forEach(route.feeds, (feed) => {
          expect(Arr.take(last(feed.points), 3)).toEqual([...pool]);
          expect(Arr.getUnsafe(feed.shares, 0)).toBe(0);
          expect(last(feed.shares)).toBeCloseTo(1, 12);
        });
        expect(Arr.take(Arr.getUnsafe(route.fill.points, 0), 3)).toEqual([
          ...pool,
        ]);
        const deep = last(route.fill.points);
        Arr.forEach(route.leaves, (leave) => {
          expect(Arr.getUnsafe(leave.points, 0)).toEqual(deep);
        });
      }
    );
  });

  it("brings dark blood down from above and up from below into the right atrium", () => {
    // The superior vena cava enters from above, the inferior from below.
    const superior = Arr.getUnsafe(ROUTES.venous.feeds, 0);
    const inferior = Arr.getUnsafe(ROUTES.venous.feeds, 1);
    expect(Arr.getUnsafe(superior.points, 0)[1]).toBeGreaterThan(5);
    expect(Arr.getUnsafe(inferior.points, 0)[1]).toBeLessThan(-4);
  });

  it("sends the dark blood up to the lungs and the bright blood over the arch and down", () => {
    const lungs = centre(ROUTES.venous, LEGS - 1e-9);
    expect(lungs[1]).toBeGreaterThan(5);
    const body = centre(ROUTES.arterial, LEGS - 1e-9);
    expect(body[1]).toBeLessThan(3);
    expect(body[2]).toBeLessThan(-4);
    // Halfway out, the bright blood is over the arch, high above the heart.
    const arch = Arr.map(
      Arr.range(0, 20),
      (step) => centre(ROUTES.arterial, 2 + step / 20)[1]
    );
    expect(Math.max(...arch)).toBeGreaterThan(7.5);
  });
});

describe("a drop's lane", () => {
  const lanes = Arr.map(Arr.range(0, 1999), (index) =>
    laneOf(index, ROUTES.arterial)
  );

  it("scatters drops over the whole stream, never at its wall", () => {
    const reaches = Arr.map(lanes, (lane) => lane.reach);
    expect(Math.max(...reaches)).toBeLessThanOrEqual(0.8);
    expect(Math.max(...reaches)).toBeGreaterThan(0.75);
    expect(Math.min(...reaches)).toBeLessThan(0.1);
  });

  it("moves faster in the middle than by the wall, at a mean speed of 1", () => {
    const mean =
      Arr.reduce(lanes, 0, (sum, lane) => sum + lane.speed) / lanes.length;
    expect(mean).toBeCloseTo(1, 1);
    const inner = laneOf(
      Arr.getUnsafe(
        Arr.filter(
          Arr.range(0, 99),
          (index) => laneOf(index, ROUTES.arterial).reach < 0.2
        ),
        0
      ),
      ROUTES.arterial
    );
    const outer = laneOf(
      Arr.getUnsafe(
        Arr.filter(
          Arr.range(0, 99),
          (index) => laneOf(index, ROUTES.arterial).reach > 0.7
        ),
        0
      ),
      ROUTES.arterial
    );
    expect(inner.speed).toBeGreaterThan(outer.speed);
  });

  it("shares the drops among every vein and every artery", () => {
    expect(Arr.dedupe(Arr.map(lanes, (lane) => lane.feed)).length).toBe(4);
    const venous = Arr.map(Arr.range(0, 9), (index) =>
      laneOf(index, ROUTES.venous)
    );
    expect(Arr.dedupe(Arr.map(venous, (lane) => lane.feed)).length).toBe(2);
    expect(Arr.dedupe(Arr.map(venous, (lane) => lane.leave)).length).toBe(2);
  });
});

describe("how fast the blood moves", () => {
  it("passes a little less than the stroke volume forward, the rest flowing back as the valves shut", () => {
    // EDV - ESV = 70 mL, part of it the leaflets' closing volume.
    expect(forward.inflow).toBeGreaterThan(60);
    expect(forward.inflow).toBeLessThan(70);
    expect(forward.outflow).toBeGreaterThan(58);
    expect(forward.outflow).toBeLessThan(70);
  });

  it("carries each leg's blood across it once a beat", () => {
    const steps = 2000;
    const step = beat.period / steps;
    const crossed = Arr.reduce(
      Arr.range(0, steps - 1),
      [0, 0, 0],
      (sums, index) => {
        const rates = legRates(
          momentAt(beat, (index + 0.5) * step),
          forward,
          beat.period
        );
        return Arr.map(
          sums,
          (sum, leg) => sum + Arr.getUnsafe(rates, leg) * step
        );
      }
    );
    Arr.forEach(crossed, (legs) => expect(legs).toBeCloseTo(1, 2));
  });

  it("lets blood through each valve only while it is open", () => {
    const systole = momentAt(beat, (beat.events.open + beat.events.shut) / 2);
    const [, filling, ejecting] = legRates(systole, forward, beat.period);
    expect(filling).toBe(0);
    expect(ejecting).toBeGreaterThan(0);
    const diastole = momentAt(
      beat,
      (beat.events.refill + beat.events.atrium) / 2
    );
    const [, refilling, shut] = legRates(diastole, forward, beat.period);
    expect(refilling).toBeGreaterThan(0);
    expect(shut).toBe(0);
    // A shutting valve's backflow does not push a drop back.
    expect(
      Arr.drop(
        legRates({ ...systole, inflow: -5, outflow: -5 }, forward, beat.period),
        1
      )
    ).toEqual([0, 0]);
  });

  it("moves a drop along its leg, holds it at a shut gate and loops it back to the veins", () => {
    const rates = [1, 0, 2] as const;
    expect(advance(0.2, 1, rates, 0.1)).toBeCloseTo(0.3, 12);
    expect(advance(0.95, 1, rates, 0.1)).toBe(1);
    expect(advance(1, 1, rates, 0.1)).toBe(1);
    expect(advance(2.5, 0.5, rates, 0.1)).toBeCloseTo(2.6, 12);
    expect(advance(2.95, 1, rates, 0.1)).toBe(0);
  });
});

describe("where a drop lies", () => {
  it("starts in its vein, crosses the valve and ends in its artery", () => {
    const start = centre(ROUTES.venous, 0);
    expect(start).toEqual([-3.5, 7.2, -1.1]);
    const pool = centre(ROUTES.venous, 1);
    const atrium = place(RIGHT_ATRIUM.along, RIGHT_ATRIUM.across, -0.6);
    Arr.forEach([0, 1, 2], (axis) =>
      expect(Arr.getUnsafe(pool, axis)).toBeCloseTo(
        Arr.getUnsafe(atrium, axis),
        9
      )
    );
  });

  it("keeps its lane's distance from the middle of the stream", () => {
    const lane = { ...middle, angle: 0, reach: 0.5 };
    const target = [0, 0, 0];
    const progress = 0.5;
    dropAt(ROUTES.arterial, lane, progress, target);
    const axis = centre(ROUTES.arterial, progress);
    const away = Math.hypot(
      Arr.getUnsafe(target, 0) - Arr.getUnsafe(axis, 0),
      Arr.getUnsafe(target, 1) - Arr.getUnsafe(axis, 1)
    );
    // A pulmonary vein's stream is 0.4 cm wide in radius.
    expect(away).toBeCloseTo(0.5 * 0.4, 6);
    const deep = { ...lane, angle: Math.PI / 2 };
    dropAt(ROUTES.arterial, deep, progress, target);
    expect(Arr.getUnsafe(target, 2) - Arr.getUnsafe(axis, 2)).toBeCloseTo(
      0.5 * 0.4 * 0.6,
      6
    );
  });
});
