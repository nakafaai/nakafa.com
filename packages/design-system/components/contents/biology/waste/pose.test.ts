// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  arcPoint,
  ease,
  loadPoint,
  pathOf,
  poseAt,
} from "@repo/design-system/components/contents/biology/waste/pose";
import {
  lipOf,
  POUR_TILT,
  VESSELS,
} from "@repo/design-system/components/contents/biology/waste/pour";
import {
  durationOf,
  routeOf,
  slotOf,
} from "@repo/design-system/components/contents/biology/waste/route";
import type { Point } from "@repo/design-system/components/contents/biology/waste/station";
import {
  AUTOCLAVE,
  CONTAINER,
  LID_LIFT,
} from "@repo/design-system/components/contents/biology/waste/station";
import { Array as Arr, Option } from "effect";

/** Expects two points to agree to the micrometre. */
function expectNear(actual: Point, expected: Point) {
  expect(actual[0]).toBeCloseTo(expected[0], 6);
  expect(actual[1]).toBeCloseTo(expected[1], 6);
  expect(actual[2]).toBeCloseTo(expected[2], 6);
}

/** The moment `kind` of `route` starts and ends, in seconds. */
function legOf(route: ReturnType<typeof routeOf>, kind: string) {
  return Option.getOrThrow(
    Arr.findFirst(route.legs, (leg) => leg.kind === kind)
  );
}

describe("easing and arcs", () => {
  it("eases from rest to rest", () => {
    expect(ease(0)).toBe(0);
    expect(ease(0.5)).toBe(0.5);
    expect(ease(1)).toBe(1);
  });

  it("peaks at its apex halfway along", () => {
    expect(arcPoint([0, 0, 0], [1, 0.2, 0], 0.5, 0.5)[1]).toBeCloseTo(0.5, 12);
    expectNear(arcPoint([0, 0, 0], [1, 0.2, 0], 1, 0.5), [1, 0.2, 0]);
  });
});

describe("loading the autoclave", () => {
  it("starts at home, rises clear of the rim, crosses level and ends on the rack", () => {
    expectNear(loadPoint(0), CONTAINER.home);
    expect(loadPoint(0.3)[1]).toBeGreaterThan(AUTOCLAVE.rim);
    expect(loadPoint(0.5)[1]).toBe(loadPoint(0.3)[1]);
    expectNear(loadPoint(1), [
      AUTOCLAVE.at[0],
      AUTOCLAVE.floor,
      AUTOCLAVE.at[2],
    ]);
  });

  it("never brings the container's foot below the rim while it overlaps the autoclave", () => {
    for (const step of Arr.range(0, 100)) {
      const [x, y, z] = loadPoint(step / 100);
      const apart = Math.hypot(x - AUTOCLAVE.at[0], z - AUTOCLAVE.at[2]);
      if (apart < CONTAINER.radius + AUTOCLAVE.bore + 0.03 && apart > 0.02) {
        expect(y).toBeGreaterThan(AUTOCLAVE.rim);
      }
    }
  });
});

describe("the pose along a route", () => {
  it("waits on the tray before the route starts", () => {
    const route = routeOf("culture", slotOf(0, 6));
    const pose = poseAt(route, -1);
    expectNear(pose.item, route.start);
    expectNear(pose.container, CONTAINER.home);
    expect(pose.lid).toBe(0);
    expect(pose.heat).toBe(0);
    expect(pose.tap).toBe(false);
    expect(pose.pouring).toBe(false);
  });

  it("rides in the container into the autoclave, with the lid lifted for it and shut on it", () => {
    const route = routeOf("culture", slotOf(0, 6));
    const open = legOf(route, "load");
    expect(poseAt(route, open.from).lid).toBeCloseTo(LID_LIFT, 12);
    const end = poseAt(route, durationOf(route));
    expectNear(end.container, [
      AUTOCLAVE.at[0],
      AUTOCLAVE.floor,
      AUTOCLAVE.at[2],
    ]);
    expectNear(end.item, [
      AUTOCLAVE.at[0],
      AUTOCLAVE.floor + route.rest[1],
      AUTOCLAVE.at[2],
    ]);
    expect(end.lid).toBe(0);
    expect(end.heat).toBe(1);
  });

  it("arcs above the straight way while it is carried", () => {
    const route = routeOf("glass", slotOf(2, 6));
    const carry = legOf(route, "carry");
    const middle = poseAt(route, (carry.from + carry.to) / 2).item[1];
    expect(middle).toBeGreaterThan(Math.max(route.lifted[1], route.entry[1]));
    const end = poseAt(route, durationOf(route));
    expectNear(end.item, route.rest);
    expect(end.rotation).toBe(0);
  });

  it("stands a blade on its edge to post it through the sharps aperture", () => {
    const route = routeOf("blade", slotOf(1, 6));
    expect(poseAt(route, durationOf(route)).rotation).toBeCloseTo(
      Math.PI / 2,
      12
    );
  });

  it("runs the tap and pours the salt solution with the lip over the sink", () => {
    const route = routeOf("salt", slotOf(3, 6));
    const tip = legOf(route, "tip");
    expect(poseAt(route, tip.from).tap).toBe(true);
    expect(poseAt(route, tip.from).pouring).toBe(false);
    const end = poseAt(route, durationOf(route));
    expect(end.rotation).toBeCloseTo(-POUR_TILT, 12);
    expect(end.pouring).toBe(true);
    const lip = lipOf(VESSELS.salt, end.item, end.rotation);
    expectNear(lip, [lip[0], 0.1, lip[2]]);
  });

  it("pours the solvent without the tap", () => {
    const route = routeOf("solvent", slotOf(4, 6));
    const end = poseAt(route, durationOf(route));
    expect(end.pouring).toBe(true);
    expect(end.tap).toBe(false);
  });
});

describe("the route's line", () => {
  it("runs from the tray to the place and leaves out the moments the item stands still", () => {
    const route = routeOf("culture", slotOf(0, 6));
    const path = pathOf(route, 64);
    expect(Arr.isReadonlyArrayNonEmpty(path)).toBe(true);
    if (Arr.isReadonlyArrayNonEmpty(path)) {
      expectNear(Arr.headNonEmpty(path), route.start);
      expectNear(Arr.lastNonEmpty(path), poseAt(route, durationOf(route)).item);
    }
    expect(path.length).toBeLessThan(65);
  });
});
