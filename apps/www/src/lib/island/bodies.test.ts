// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option, Order } from "effect";
import {
  BODY_STRIDE,
  bodiesOf,
  joined,
  seaBodies,
  whaleAt,
} from "@/lib/island/bodies";
import { ballAt } from "@/lib/island/hunt";
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
    const [cx, cy, cz, cyaw, cbob] = of("cow");
    expect([cx, cy, cz]).toEqual([4.5, 9, 4.5]);
    expect(cyaw).toBeCloseTo(Math.PI / 2);
    expect(cbob).toBeGreaterThan(0);
    expect(of("duck")[1]).toBeCloseTo(SEA_LEVEL - 0.2);
    expect(of("duck")[4]).toBe(0);
    expect(of("hen")[1]).toBe(SEA_LEVEL);
    expect(of("cat")).toHaveLength(0);
    expect(of("whale")).toHaveLength(BODY_STRIDE);
    expect(of("cow")[5]).toBe(0);
  });

  it("swims the whale round the island in deep water, its back rising and sinking at the sea's face, facing its way", () => {
    for (const time of [0, 13, 40, 97]) {
      const whale = whaleAt(time);
      const reach = Math.hypot(whale.x - SPAN / 2, whale.z - SPAN / 2);
      expect(reach).toBeGreaterThan(SPAN / 2 + 10);
      expect(Math.abs(whale.y - SEA_LEVEL)).toBeLessThan(1);
      expect(whale.pitch).toBe(0);
      const later = whaleAt(time + 0.05);
      expect(Math.atan2(later.x - whale.x, later.z - whale.z)).toBeCloseTo(
        whale.yaw,
        2
      );
    }
  });

  it("breaches the whale now and then: it dives nose up, leaves the sea whole, falls back flat and swims on", () => {
    const flight = Arr.makeBy(141, (step) => whaleAt(20 + step * 0.1));
    const top = Math.max(...Arr.map(flight, (whale) => whale.y));
    // Its middle clears the sea by more than half its own height, so the whole body leaves the water.
    expect(top).toBeGreaterThan(SEA_LEVEL + 2);
    expect(whaleAt(22.9).y).toBeLessThan(SEA_LEVEL - 3);
    expect(whaleAt(22.9).pitch).toBeGreaterThan(1.1);
    expect(whaleAt(21).pitch).toBeLessThan(0);
    // Falling back, it lands flat on the sea, nose a little down, and levels as it swims on.
    expect(whaleAt(25.1).pitch).toBeCloseTo(-0.5, 1);
    expect(whaleAt(27).pitch).toBeLessThan(0);
    expect(whaleAt(27).pitch).toBeGreaterThan(-0.5);
    expect(whaleAt(30).pitch).toBe(0);
    expect(Math.abs(whaleAt(30).y - SEA_LEVEL)).toBeLessThan(1);
    // The next breach comes a cycle later.
    expect(whaleAt(66 + 3 + 1.1).y).toBeGreaterThan(SEA_LEVEL + 2);
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

  it("tips a leaping dolphin's nose up as it rises and down as it dives, and keeps it level under the sea", () => {
    const dolphins = Arr.flatMap(
      Arr.makeBy(120, (step) => step * 0.1),
      (time) =>
        Arr.flatMap(seaBodies(7, time), ([model, places]) =>
          model.kind === "dolphin"
            ? Arr.chunksOf(Array.from(places), BODY_STRIDE)
            : []
        )
    );
    const under = Arr.filter(dolphins, (body) => body[1] < SEA_LEVEL - 0.69);
    expect(under.length).toBeGreaterThan(0);
    Arr.forEach(under, (body) => expect(body[5]).toBe(0));
    expect(Arr.some(dolphins, (body) => body[5] > 0.3)).toBe(true);
    expect(Arr.some(dolphins, (body) => body[5] < -0.3)).toBe(true);
  });

  it("puts the reef shark on the bait ball's round instead of a round of its own", () => {
    Arr.forEach([0, 9, 14.6, 31], (time) => {
      const shark = Arr.findFirst(
        seaBodies(7, time),
        ([model]) => model.kind === "reef-shark"
      ).pipe(
        Option.map(([, places]) => Array.from(places)),
        Option.getOrElse(() => [])
      );
      const ball = ballAt(7, time);
      expect(shark).toHaveLength(BODY_STRIDE);
      expect(Math.hypot(shark[0] - ball.x, shark[2] - ball.z)).toBeLessThan(
        2.5
      );
    });
  });

  it("joins the runs of a model that comes twice, and passes a model that comes once untouched", () => {
    const once = Float32Array.from([1, 2, 3, 4, 5, 6]);
    const bodies = joined([
      [{ _tag: "species", index: 3 }, Float32Array.from([1, 1, 1, 0, 0, 0])],
      [{ _tag: "plant", index: 2 }, once],
      [{ _tag: "species", index: 3 }, Float32Array.from([2, 2, 2, 0, 0, 0])],
    ]);
    expect(bodies).toHaveLength(2);
    const [species, plant] = bodies;
    expect(Array.from(species[1])).toEqual([
      1, 1, 1, 0, 0, 0, 2, 2, 2, 0, 0, 0,
    ]);
    expect(plant[1]).toBe(once);
  });
});
