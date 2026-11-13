// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option, Order } from "effect";
import {
  BODY_STRIDE,
  bodiesOf,
  NO_SHADOW,
  seaBodies,
  whaleAt,
} from "@/lib/island/bodies";
import { islesOf } from "@/lib/island/isles";
import type { Animal } from "@/lib/island/life";
import { bodyFaces } from "@/lib/island/models/kinds";
import { Swimmer, swimmerFaces } from "@/lib/island/models/ocean";
import { boundsOf } from "@/lib/island/models/parts";
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
      Arr.findFirst(
        bodies,
        ([own]) => own._tag === "body" && own.kind === kind
      ).pipe(
        Option.map(([, places]) => Array.from(places)),
        Option.getOrElse(() => [])
      );
    const [cx, cy, cz, cyaw, cbob, cground] = of("cow");
    expect([cx, cy, cz, cground]).toEqual([4.5, 9, 4.5, 9]);
    expect(cyaw).toBeCloseTo(Math.PI / 2);
    expect(cbob).toBeGreaterThan(0);
    expect(of("duck")[1]).toBeCloseTo(SEA_LEVEL - 0.2);
    expect(of("duck")[4]).toBe(0);
    expect(of("hen")[1]).toBe(SEA_LEVEL);
    expect(of("cat")).toHaveLength(0);
    expect(of("whale")).toHaveLength(BODY_STRIDE);
    expect(of("whale")[5]).toBe(NO_SHADOW);
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

  it("swims every big swimmer of the open sea on a round of its own, past the whale's and clear of every isle, facing its way", () => {
    const middle = SPAN / 2;
    /** How far a body of these faces reaches across its round: half its width, and how far its ends bow out from a round this wide. */
    const across = (faces: ReturnType<typeof bodyFaces>, lane: number) => {
      const bounds = boundsOf(faces);
      const length = bounds.z[1] - bounds.z[0];
      return (bounds.x[1] - bounds.x[0]) / 2 + (length * length) / (8 * lane);
    };
    const whaleLane = Math.hypot(whaleAt(0).x - middle, whaleAt(0).z - middle);
    const lanes = Arr.flatMap(seaBodies(7, 30), ([model, places]) => {
      expect(model._tag).toBe("swimmer");
      return Arr.map(Arr.chunksOf(Array.from(places), BODY_STRIDE), (body) => {
        expect(body[5]).toBe(NO_SHADOW);
        const lane = Math.hypot(body[0] - middle, body[2] - middle);
        const reach = across(swimmerFaces(model.kind), lane);
        return { inner: lane - reach, outer: lane + reach };
      });
    });
    expect(lanes.length).toBeGreaterThanOrEqual(Swimmer.literals.length);
    const sorted = Arr.sort(
      [
        {
          inner: whaleLane - across(bodyFaces("whale"), whaleLane),
          outer: whaleLane + across(bodyFaces("whale"), whaleLane),
        },
        ...lanes,
      ],
      Order.mapInput(Order.Number, (lane: (typeof lanes)[number]) => lane.inner)
    );
    Arr.forEach(Arr.zip(sorted, Arr.drop(sorted, 1)), ([near, far]) =>
      expect(far.inner).toBeGreaterThan(near.outer)
    );
    for (const seed of [1, 7, 42, 1009]) {
      const isles = islesOf(seed);
      for (const lane of lanes) {
        for (const isle of isles) {
          const away = Math.hypot(isle.x - middle, isle.z - middle);
          const reach = isle.radius * 1.2;
          expect(lane.outer < away - reach || lane.inner > away + reach).toBe(
            true
          );
        }
      }
    }
  });

  it("keeps the swimmers under the sea, but for a dolphin's leap now and then", () => {
    const tops = Arr.flatMap(
      Arr.makeBy(400, (step) => step * 0.25),
      (time) =>
        Arr.flatMap(seaBodies(7, time), ([model, places]) =>
          Arr.map(Arr.chunksOf(Array.from(places), BODY_STRIDE), (body) => ({
            kind: model.kind,
            y: body[1],
          }))
        )
    );
    for (const top of tops) {
      if (top.kind !== "dolphin") {
        expect(top.y).toBeLessThan(SEA_LEVEL);
      }
    }
    expect(
      Arr.some(tops, (top) => top.kind === "dolphin" && top.y > SEA_LEVEL)
    ).toBe(true);
    expect(
      Arr.some(tops, (top) => top.kind === "dolphin" && top.y < SEA_LEVEL)
    ).toBe(true);
  });
});
