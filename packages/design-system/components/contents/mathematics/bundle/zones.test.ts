// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { placeDigits } from "@repo/design-system/components/contents/mathematics/bundle/digits";
import {
  boxSize,
  SINGLE_SIZE,
  traySize,
} from "@repo/design-system/components/contents/mathematics/bundle/layout";
import {
  deskZones,
  LABEL_Z,
  zoneFootprint,
  zoneSlot,
} from "@repo/design-system/components/contents/mathematics/bundle/zones";
import { Array as Arr } from "effect";

describe("bundle zones", () => {
  it("sets the zones from the tray on the left to loose sticks on the right, round the middle", () => {
    const zones = deskZones(237, 5);
    expect(zones).toHaveLength(4);
    const [singles, bundles, boxes, tray] = zones;
    expect(singles?.x).toBeGreaterThan(bundles?.x ?? 0);
    expect(bundles?.x).toBeGreaterThan(boxes?.x ?? 0);
    expect(boxes?.x).toBeGreaterThan(tray?.x ?? 0);
    const right = Arr.getUnsafe(zones, 0);
    const left = Arr.getUnsafe(zones, 3);
    expect(left.x - left.size.length / 2).toBeCloseTo(
      -(right.x + right.size.length / 2)
    );
    expect(left.size).toEqual(traySize(5));
    expect(deskZones(7, 8)).toEqual([
      { columns: 1, line: 7, size: SINGLE_SIZE, x: 0 },
    ]);
  });

  it("gives every place a line long enough for its digit, and wraps boxes after four", () => {
    for (const base of Arr.range(2, 9)) {
      const [singles, bundles] = deskZones(base * base - 1, base);
      expect(singles?.line).toBe(base - 1);
      expect(bundles?.line).toBeGreaterThanOrEqual(base - 1);
    }
    expect(placeDigits(300, 7)).toEqual([6, 0, 6, 0]);
    const wrapped = Arr.getUnsafe(deskZones(300, 7), 2);
    expect(wrapped).toMatchObject({ columns: 2, line: 4, size: boxSize(7) });
    expect(Arr.getUnsafe(deskZones(125, 5), 2).columns).toBe(1);
  });

  it("lays a zone's things flat in a line from the front, then beside it, then a layer higher", () => {
    const zone = Arr.getUnsafe(deskZones(300, 7), 2);
    const first = zoneSlot(0, zone);
    const second = zoneSlot(1, zone);
    expect(first.y).toBe(0);
    expect(LABEL_Z).toBeGreaterThan(first.z + zone.size.depth / 2);
    expect(first.z - second.z).toBeGreaterThan(zone.size.depth);
    const beside = zoneSlot(4, zone);
    expect(beside).toMatchObject({ y: 0, z: first.z });
    expect(beside.x - first.x).toBeGreaterThan(zone.size.length);
    expect(first.x + beside.x).toBeCloseTo(2 * zone.x);
    const above = zoneSlot(8, zone);
    expect(above).toEqual({ ...first, y: zone.size.height });
  });

  it("measures the room a zone's things take, flat at rest and stacked while they wait", () => {
    const zone = Arr.getUnsafe(deskZones(300, 7), 2);
    const six = zoneFootprint(zone, 6, zone.size.height);
    expect(six.x.max - six.x.min).toBeCloseTo(2 * zone.size.length + 0.014);
    expect(six.y).toEqual({ max: zone.size.height, min: 0 });
    expect(six.z.max).toBeGreaterThan(zoneSlot(0, zone).z);
    expect(six.z.min).toBeLessThan(zoneSlot(3, zone).z - zone.size.depth / 2);
    const nine = zoneFootprint(zone, 9, 0.05);
    expect(nine.y.max).toBeCloseTo(0.1);
    expect(nine.z).toEqual(six.z);
    const none = zoneFootprint(zone, 0, 0.05);
    expect(none.z.min).toBe(none.z.max);
    expect(none.y.max).toBe(0);
  });
});
