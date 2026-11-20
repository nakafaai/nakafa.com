// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import { CAST } from "@/lib/island/fauna/cast";
import { CELL, surveyOf } from "@/lib/island/fauna/habitat";
import { SPECIES } from "@/lib/island/fauna/species";
import { ballAt } from "@/lib/island/hunt";
import { modelKey } from "@/lib/island/models/kinds";
import type { School } from "@/lib/island/schools";
import { baitOf, schoolBodies, schoolsOf } from "@/lib/island/schools";
import { floodAll, GROUND, plainOf, speciesOf } from "@/lib/island/test.world";

const DICE = { day: 20_000, gx: 0, gz: 0, seed: 1 };

/** A school on a round of seven blocks about the middle of a sea. */
const RING = {
  _tag: "ring",
  count: 8,
  depth: 2,
  floor: false,
  index: speciesOf("mackerel"),
  radius: 7,
  seed: 5,
  speed: 0.8,
  start: 1,
  surface: GROUND,
  x: 32,
  z: 32,
} as const;

/** The bodies of one school at a time, six numbers each. */
const bodiesOf = (
  land: Parameters<typeof schoolBodies>[0],
  school: School,
  time: number
) =>
  Arr.chunksOf(Arr.fromIterable(schoolBodies(land, [school], time)[0][1]), 6);

/** A cell of water `depth` blocks deep, as the sea or as a lake. */
function waterOf(depth: number, water: "lake" | "sea") {
  const land = plainOf(2);
  floodAll(land, [0, 0], [CELL, CELL], depth, water);
  return land;
}

/** The species of the schools of a cell, by their keys, each with its kind of school. */
const namesOf = (schools: readonly School[]) =>
  Arr.map(schools, (school) => `${school._tag}:${SPECIES[school.index].key}`);

describe("island/schools", () => {
  it("swims a school round its place as one, every fish between the floor and the water's face, facing its way", () => {
    const land = waterOf(5, "sea");
    const fish = bodiesOf(land, RING, 10);
    expect(fish).toHaveLength(8);
    for (const [x, y, z] of fish) {
      expect(Math.hypot(x - 32, z - 32)).toBeGreaterThan(5);
      expect(Math.hypot(x - 32, z - 32)).toBeLessThan(9);
      expect(y).toBeGreaterThan(GROUND - 5);
      expect(y).toBeLessThan(GROUND - 0.2);
    }
    expect(schoolBodies(land, [RING], 10)[0][0]).toEqual({
      _tag: "species",
      index: RING.index,
    });
    // The school turns the way it swims, and the other way when its round runs backward.
    const middle = (time: number, speed: number) => {
      const all = bodiesOf(land, { ...RING, speed }, time);
      return [
        Arr.reduce(all, 0, (sum, at) => sum + at[0]) / all.length,
        Arr.reduce(all, 0, (sum, at) => sum + at[2]) / all.length,
        Arr.reduce(all, 0, (sum, at) => sum + at[3]) / all.length,
      ] as const;
    };
    const [here, there] = [middle(10, 0.8), middle(10.5, 0.8)];
    expect(Math.atan2(there[0] - here[0], there[1] - here[1])).toBeCloseTo(
      here[2],
      0
    );
    const [back, on] = [middle(10, -0.8), middle(10.5, -0.8)];
    expect(Math.atan2(on[0] - back[0], on[1] - back[1])).toBeCloseTo(
      back[2],
      0
    );
  });

  it("leaves a fish out where the water is too shallow for it, and stands a lobster on the floor", () => {
    const shallow = waterOf(0.2, "sea");
    expect(bodiesOf(shallow, RING, 10)).toEqual([]);
    const land = waterOf(3, "sea");
    const lobster = bodiesOf(
      land,
      { ...RING, count: 1, floor: true, index: speciesOf("lobster") },
      4
    );
    expect(lobster).toHaveLength(1);
    expect(lobster[0][1]).toBe(GROUND - 3);
  });

  it("keeps a pair of clownfish darting over their anemone, one each way", () => {
    const land = waterOf(3, "sea");
    const pair = {
      _tag: "pair",
      index: speciesOf("clownfish"),
      order: 1,
      x: 20,
      y: GROUND - 3,
      z: 24,
    } as const;
    const fish = bodiesOf(land, pair, 3);
    expect(fish).toHaveLength(2);
    for (const [x, y, z] of fish) {
      expect(Math.hypot(x - 20, z - 24)).toBeLessThan(0.25);
      expect(y).toBeGreaterThan(GROUND - 2.8);
      expect(y).toBeLessThan(GROUND - 2.6);
    }
    expect(bodiesOf(land, pair, 3.4)).not.toEqual(fish);
  });

  it("mills a bait ball round its middle and bursts it to either side of the shark's charge", () => {
    const land = waterOf(6, "sea");
    const hunt = { lane: 5, seed: 3, x: 32, y: GROUND - 2, z: 32 };
    const bait = Option.getOrThrow(baitOf(hunt));
    expect(namesOf([bait])).toEqual(["bait:mackerel"]);
    const spreadAt = (time: number) => {
      const ball = ballAt(hunt, time);
      return Math.max(
        ...Arr.map(bodiesOf(land, bait, time), ([x, , z]) =>
          Math.hypot(x - ball.x, z - ball.z)
        )
      );
    };
    expect(bodiesOf(land, bait, 5)).toHaveLength(16);
    expect(spreadAt(16.5)).toBeGreaterThan(spreadAt(5) + 1);
    expect(spreadAt(21)).toBeCloseTo(spreadAt(5), 1);
  });

  it("finds a river's fish in fresh water, and a second shoal of the day in a lake large enough", () => {
    const pond = plainOf(2);
    floodAll(pond, [8, 8], [24, 24], 1.5, "lake");
    const few = schoolsOf(pond, surveyOf(pond, 0, 0), DICE, []);
    expect(few).toHaveLength(1);
    expect(Arr.contains(CAST.fresh, few[0].index)).toBe(true);
    const lake = waterOf(2, "lake");
    const survey = surveyOf(lake, 0, 0);
    const many = schoolsOf(lake, survey, DICE, []);
    expect(many).toHaveLength(2);
    expect(Arr.every(many, (school) => school._tag === "ring")).toBe(true);
    // The resident stays; the visitor is the day's.
    const days = Arr.map(Arr.range(0, 30), (day) =>
      namesOf(schoolsOf(lake, survey, { ...DICE, day }, []))
    );
    expect(Arr.dedupe(Arr.map(days, (names) => names[0]))).toHaveLength(1);
    expect(
      Arr.dedupe(Arr.map(days, (names) => names[1])).length
    ).toBeGreaterThan(3);
    expect(schoolsOf(plainOf(2), surveyOf(plainOf(2), 0, 0), DICE, [])).toEqual(
      []
    );
  });

  it("keeps the reef's own schools, clownfish and a turtle over a cell's corals, with a lurker of the day in its shallows", () => {
    const land = waterOf(2, "sea");
    const survey = surveyOf(land, 0, 0);
    const corals = Arr.map(Arr.range(0, 4), (slot) => ({
      anemone: slot % 2 === 1,
      x: 10 + slot * 6,
      y: GROUND - 2,
      z: 20,
    }));
    const reef = schoolsOf(land, survey, DICE, corals);
    const names = namesOf(reef);
    expect(Arr.filter(names, (name) => name === "pair:clownfish")).toHaveLength(
      2
    );
    expect(
      Arr.filter(reef, (school) => Arr.contains(CAST.reef, school.index))
    ).toHaveLength(3);
    expect(
      Arr.filter(reef, (school) => Arr.contains(CAST.turtles, school.index))
    ).toHaveLength(1);
    expect(
      Arr.filter(reef, (school) => Arr.contains(CAST.lurkers, school.index))
    ).toHaveLength(1);
    expect(reef).toHaveLength(7);
    // A turtle and a lurker swim alone; a lobster walks the floor.
    const alone = Arr.filter(
      reef,
      (school) => school._tag === "ring" && school.count === 1
    );
    expect(alone).toHaveLength(2);
    const lobsters = Arr.flatMap(Arr.range(0, 60), (day) =>
      Arr.filter(
        schoolsOf(land, survey, { ...DICE, day }, []),
        (school) => school._tag === "ring" && school.floor
      )
    );
    expect(lobsters.length).toBeGreaterThan(0);
    expect(namesOf(lobsters)).toContain("ring:lobster");
    // Shallows with no coral hold the lurker alone.
    expect(schoolsOf(land, survey, DICE, [])).toHaveLength(1);
    expect(
      Arr.map(bodiesOf(land, reef[0], 2), (at) => at[1] < GROUND)
    ).not.toContain(false);
  });

  it("never leaves the open sea empty: a shoal that lives there and another the day brings", () => {
    const land = waterOf(8, "sea");
    const survey = surveyOf(land, 0, 0);
    const shoals = schoolsOf(land, survey, DICE, []);
    expect(shoals).toHaveLength(2);
    expect(
      Arr.every(shoals, (school) => Arr.contains(CAST.pelagic, school.index))
    ).toBe(true);
    expect(Arr.map(shoals, modelOf)).toEqual(
      Arr.map(shoals, (school) => `species-${school.index}`)
    );
    expect(schoolsOf(land, survey, DICE, [])).toEqual(shoals);
    // A manta glides alone; mackerel shoal by the handful.
    const counts = Arr.flatMap(Arr.range(0, 60), (day) =>
      Arr.map(schoolsOf(land, survey, { ...DICE, day }, []), (school) =>
        school._tag === "ring"
          ? `${SPECIES[school.index].key}:${school.count}`
          : ""
      )
    );
    expect(counts).toContain("manta:1");
    expect(counts).toContain("mackerel:8");
  });
});

/** The key of the model a school is drawn with. */
function modelOf(school: School) {
  return modelKey({ _tag: "species", index: school.index });
}
