// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import { surveyOf } from "@/lib/island/fauna/habitat";
import { rootAt, rootsOf } from "@/lib/island/flora/rooted";
import type { Land } from "@/lib/island/land/ground";
import { modelKey } from "@/lib/island/models/kinds";
import { suitsOf } from "@/lib/island/room";
import type { Villager } from "@/lib/island/routine";
import {
  isAsleep,
  keepDay,
  tackleBodies,
  villagersOf,
} from "@/lib/island/routine";
import { bareOf, floodAll, GROUND, setThings } from "@/lib/island/test.world";

const DICE = { day: 20_000, gx: 0, gz: 0, seed: 1 };

/** Nothing stands in a walker's way. */
const open = () => false;

/** The villagers of the cell at the origin, from what stands in it. */
function folkOf(
  land: Land,
  lives: Partial<Parameters<typeof villagersOf>[4]> = {}
) {
  const roots = rootsOf();
  return villagersOf(
    land,
    Arr.flatMap(
      [0, 1, 2, 3],
      (slot) => rootAt(roots, land, slot % 2, Math.floor(slot / 2)).standing
    ),
    surveyOf(land, 0, 0),
    DICE,
    { camp: Option.none(), held: [], ...lives }
  );
}

/** A village of two cottages, a well and a bench, with a lake to its east. */
function village() {
  const land = bareOf(2);
  setThings(
    land,
    [0, 0],
    [
      ["cottage", 10, 10, 0],
      ["cottage", 22, 10, 2],
      ["well", 16, 22, 0],
      ["bench", 8, 24, 0],
    ]
  );
  floodAll(land, [44, 0], [64, 64], 1.5, "lake");
  return land;
}

/** A villager after its day has run `seconds` at `hour`, a tenth of a second a step. */
const after = (land: Land, villager: Villager, hour: number, seconds: number) =>
  Arr.reduce(Arr.range(1, seconds * 10), villager, (now) =>
    keepDay(land, now, { blocked: open, dt: 0.1, hour, others: [] })
  );

/** How far a villager stands from a spot. */
const awayFrom = (villager: Villager, spot: readonly [number, number]) =>
  Math.hypot(villager.body.x - spot[0], villager.body.z - spot[1]);

describe("island/routine", () => {
  it("gives each cottage a villager at its doorstep, with a place to gather and a place to visit among what the learner built", () => {
    const folk = folkOf(village());
    expect(Arr.map(folk, (villager) => villager.body.kind)).toEqual([
      "cat",
      "rabbit",
    ]);
    const [cat, rabbit] = folk;
    // A doorstep lies before the cottage's front, which a half turn brings round.
    expect(cat.home[0]).toBeCloseTo(10, 6);
    expect(cat.home[1]).toBeGreaterThan(13);
    expect(rabbit.home[1]).toBeLessThan(7);
    expect([cat.body.x, cat.body.z]).toEqual([...cat.home]);
    expect(cat.indoors).toBe(true);
    expect(Math.hypot(cat.plaza[0] - 16, cat.plaza[1] - 22)).toBeLessThan(3);
    expect(Math.hypot(rabbit.plaza[0] - 16, rabbit.plaza[1] - 22)).toBeLessThan(
      3
    );
    expect(rabbit.plaza).not.toEqual(cat.plaza);
    // By day the rabbit visits the well from a side of its own; the cat would sit by the bench, did it not fish.
    expect(Math.hypot(rabbit.work[0] - 16, rabbit.work[1] - 22)).toBeLessThan(
      3
    );
    expect(rabbit.work).not.toEqual(rabbit.plaza);
    expect(rabbit.fishes).toBe(false);
    expect(rabbit.water).toEqual(rabbit.home);
  });

  it("sends the first villager to fish from the dry bank nearest home, looking out on the water", () => {
    const land = village();
    const [cat] = folkOf(land);
    expect(cat.fishes).toBe(true);
    expect(suitsOf(land, "dry", cat.work[0], cat.work[1])).toBe(true);
    expect(cat.work[0]).toBeGreaterThan(40);
    expect(cat.work[0]).toBeLessThan(44);
    expect(cat.water[0]).toBeGreaterThan(44);
    // With no water in the cell, or none a bank leads to, nobody fishes.
    const dry = bareOf(2);
    setThings(dry, [0, 0], [["cottage", 10, 10, 0]]);
    const [inland] = folkOf(dry);
    expect(inland.fishes).toBe(false);
    expect(inland.plaza).toEqual(inland.home);
    expect(inland.work).toEqual(inland.home);
    const drowned = bareOf(2);
    setThings(drowned, [0, 0], [["cottage", 10, 10, 0]]);
    floodAll(drowned, [-32, -32], [96, 96], 1.5, "lake");
    expect(folkOf(drowned)[0].fishes).toBe(false);
  });

  it("houses three villagers at most, camps two at the fire where nothing is built and the world opens, and nobody elsewhere", () => {
    const town = bareOf(2);
    setThings(
      town,
      [0, 0],
      [
        ["cottage", 6, 6, 0],
        ["cottage", 16, 6, 0],
        ["cottage", 26, 6, 0],
        ["cottage", 6, 22, 0],
      ]
    );
    expect(Arr.map(folkOf(town), (villager) => villager.body.kind)).toEqual([
      "cat",
      "rabbit",
      "bear",
    ]);
    const wild = bareOf(2);
    expect(folkOf(wild)).toEqual([]);
    const campers = folkOf(wild, { camp: Option.some([30, 30]) });
    expect(Arr.map(campers, (villager) => villager.body.kind)).toEqual([
      "cat",
      "rabbit",
    ]);
    for (const camper of campers) {
      expect(camper.indoors).toBe(false);
      expect(awayFrom(camper, [30, 30])).toBeLessThan(2);
      // Sleeping by the fire, a camper is still seen.
      expect(isAsleep(camper, 2)).toBe(false);
    }
    // A cottage built in the camp's cell takes the campers in, and who was there keeps where they stand.
    const moved = { ...campers[0], body: { ...campers[0].body, x: 40, z: 41 } };
    setThings(wild, [0, 0], [["cottage", 10, 10, 0]]);
    const settled = folkOf(wild, {
      camp: Option.some([30, 30]),
      held: [moved],
    });
    expect(settled).toHaveLength(1);
    expect([settled[0].body.x, settled[0].body.z]).toEqual([40, 41]);
    expect(settled[0].indoors).toBe(true);
  });

  it("keeps each villager's hours: home by night and asleep indoors, gathered in the morning and the evening, at work by day", () => {
    const land = village();
    const [, rabbit] = folkOf(land);
    expect(isAsleep(rabbit, 3)).toBe(true);
    const morning = after(land, rabbit, 7.5, 40);
    expect(awayFrom(morning, rabbit.plaza)).toBeLessThan(1.6);
    expect(isAsleep(morning, 7.5)).toBe(false);
    const working = after(land, morning, 12, 40);
    expect(awayFrom(working, rabbit.work)).toBeLessThan(1.6);
    const evening = after(land, working, 19, 40);
    expect(awayFrom(evening, rabbit.plaza)).toBeLessThan(1.6);
    // Away from home at midnight it is still seen, until it reaches its door.
    expect(isAsleep(evening, 23.9)).toBe(false);
    const night = after(land, evening, 23.9, 60);
    expect(awayFrom(night, rabbit.home)).toBeLessThan(1.6);
    // Each keeps the hours a little later than the one before: at a quarter past six the cat is up and the rabbit not yet.
    const [cat] = folkOf(land);
    expect(awayFrom(after(land, cat, 6.25, 30), cat.home)).toBeGreaterThan(3);
    expect(awayFrom(after(land, rabbit, 6.25, 30), rabbit.home)).toBeLessThan(
      1.6
    );
  });

  it("walks without dawdling, and pauses where its way is blocked", () => {
    const land = village();
    const [, rabbit] = folkOf(land);
    const first = keepDay(land, rabbit, {
      blocked: open,
      dt: 0.1,
      hour: 12,
      others: [],
    });
    expect(first.body.steps).toBe(1);
    expect(first.body.rest).toBeLessThanOrEqual(0.6);
    const walled = Arr.reduce(Arr.range(1, 12), rabbit, (now) =>
      keepDay(land, now, { blocked: () => true, dt: 0.1, hour: 12, others: [] })
    );
    expect(awayFrom(walled, rabbit.home)).toBe(0);
    expect(walled.body.rest).toBeGreaterThan(0);
  });

  it("stands the fisher on its bank by day, facing the water, with its rod held out over it", () => {
    const land = village();
    const [cat, rabbit] = folkOf(land);
    expect(tackleBodies(land, [cat, rabbit], 12)).toEqual([]);
    const fishing = after(land, cat, 12, 60);
    expect(awayFrom(fishing, cat.work)).toBeLessThanOrEqual(1);
    const held = keepDay(land, fishing, {
      blocked: open,
      dt: 0.1,
      hour: 12,
      others: [],
    });
    expect([held.body.x, held.body.z]).toEqual([
      fishing.body.x,
      fishing.body.z,
    ]);
    expect(held.body.rest).toBeGreaterThan(0);
    expect(held.body.tx).toBeGreaterThan(held.body.x);
    const rods = tackleBodies(land, [fishing, rabbit], 12);
    expect(rods).toHaveLength(1);
    expect(modelKey(rods[0][0])).toBe("tackle");
    const [x, y, z, yaw] = rods[0][1];
    expect([x, y, z]).toEqual([
      Math.fround(fishing.body.x),
      GROUND,
      Math.fround(fishing.body.z),
    ]);
    expect(yaw).toBeCloseTo(
      Math.atan2(cat.water[0] - fishing.body.x, cat.water[1] - fishing.body.z),
      5
    );
    // In the evening it leaves the bank, and the rod with it.
    expect(tackleBodies(land, [fishing], 19)).toEqual([]);
  });
});
