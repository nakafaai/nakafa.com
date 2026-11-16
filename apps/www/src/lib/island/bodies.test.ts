// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option } from "effect";
import { BODY_STRIDE, bodiesOf, whaleAt } from "@/lib/island/bodies";
import type { Animal } from "@/lib/island/life";
import { cellOf, emptyCells, SEA_LEVEL } from "@/lib/island/world";

/** An animal of a kind standing still at (x, z), facing its goal (tx, tz). */
const animal = (
  kind: Animal["kind"],
  x: number,
  z: number,
  tx = x,
  tz = z,
  rest = 1
): Animal => ({ kind, rest, steps: 0, tx, tz, x, z });

describe("island/bodies", () => {
  it("stands each animal on its own ground, a duck a little sunk in the water, facing where it goes", () => {
    const cells = emptyCells();
    cells[cellOf(4, 8, 4)] = idOf("grass");
    cells[cellOf(9, SEA_LEVEL - 1, 9)] = idOf("water");
    const bodies = bodiesOf(
      cells,
      [
        animal("cow", 4.5, 4.5, 6.5, 4.5, 0),
        animal("duck", 9.5, 9.5),
        animal("hen", 30.5, 30.5),
      ],
      0
    );
    const of = (kind: string) =>
      Arr.findFirst(bodies, ([own]) => own === kind).pipe(
        Option.map(([, places]) => Array.from(places)),
        Option.getOrElse(() => [])
      );
    const [cx, cy, cz, cyaw, cbob] = of("cow");
    expect([cx, cy, cz]).toEqual([4.5, 9, 4.5]);
    expect(cyaw).toBeCloseTo(Math.PI / 2);
    expect(cbob).toBeGreaterThan(0);
    expect(of("duck")[1]).toBeCloseTo(SEA_LEVEL - 0.2);
    expect(of("duck")[4]).toBe(0);
    expect(of("hen")[1]).toBe(SEA_LEVEL);
    expect(of("cat")).toHaveLength(0);
    expect(of("whale")).toHaveLength(BODY_STRIDE);
  });

  it("swims the whale round the island in deep water, its back rising and sinking at the sea's face, facing its way", () => {
    for (const time of [0, 13, 40, 97]) {
      const whale = whaleAt(time);
      const reach = Math.hypot(whale.x - SPAN / 2, whale.z - SPAN / 2);
      expect(reach).toBeGreaterThan(SPAN / 2 + 10);
      expect(Math.abs(whale.y - SEA_LEVEL)).toBeLessThan(1);
      const later = whaleAt(time + 0.05);
      expect(Math.atan2(later.x - whale.x, later.z - whale.z)).toBeCloseTo(
        whale.yaw,
        2
      );
    }
  });
});
