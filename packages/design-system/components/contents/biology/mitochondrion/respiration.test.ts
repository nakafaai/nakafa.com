// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import type { Point } from "@repo/design-system/components/contents/biology/mitochondrion/anatomy";
import { SYNTHASES } from "@repo/design-system/components/contents/biology/mitochondrion/particles";
import type {
  Condition,
  Molecule,
  Trip,
} from "@repo/design-system/components/contents/biology/mitochondrion/respiration";
import {
  atpAtMembrane,
  atpMade,
  conditionOf,
  ease,
  GLYCOLYSIS,
  GLYCOLYSIS_ATP,
  JOURNEYS,
  oxygenSite,
  presence,
  progress,
  STILL,
  tripsOf,
  yieldOf,
} from "@repo/design-system/components/contents/biology/mitochondrion/respiration";
import { compartmentOf } from "@repo/design-system/components/contents/biology/mitochondrion/test/compartment";
import { Array as Arr, Option } from "effect";

/** The trips of one molecule. */
function tripsFor(condition: Condition, molecule: Molecule, atp = 32) {
  return Arr.filter(
    tripsOf(condition, atp),
    (trip) => trip.molecule === molecule
  );
}

/** The first and last points of a trip's path. */
function ends(trip: Trip) {
  const first = Arr.head(trip.path).pipe(Option.getOrThrow);
  const last = Arr.last(trip.path).pipe(Option.getOrThrow);
  return [first, last] as const;
}

/** Whether `a` and `b` are the same point. */
function same(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-9;
}

describe("what one glucose gives", () => {
  it("respires aerobically with oxygen and ferments without it, by the cell", () => {
    expect(conditionOf(true, "muscle")).toBe("aerobic");
    expect(conditionOf(true, "yeast")).toBe("aerobic");
    expect(conditionOf(false, "muscle")).toBe("lactic");
    expect(conditionOf(false, "yeast")).toBe("alcoholic");
  });

  it("balances every atom of C6H12O6 + 6 O2 → 6 CO2 + 6 H2O", () => {
    const { carbonDioxide, oxygen, water } = yieldOf("aerobic");
    expect(carbonDioxide).toBe(6);
    expect(6 + 2 * oxygen).toBe(2 * carbonDioxide + water);
    expect(12).toBe(2 * water);
  });

  it("balances both fermentations: 2 lactic acid, or 2 ethanol and 2 CO2", () => {
    const lactic = yieldOf("lactic");
    const alcoholic = yieldOf("alcoholic");
    expect([lactic.carbonDioxide, lactic.oxygen, lactic.water]).toEqual([
      0, 0, 0,
    ]);
    expect([
      alcoholic.carbonDioxide,
      alcoholic.oxygen,
      alcoholic.water,
    ]).toEqual([2, 0, 0]);
    // C6H12O6 → 2 C2H5OH + 2 CO2: carbon 6 = 4 + 2, oxygen 6 = 2 + 4.
    expect(2 * 2 + alcoholic.carbonDioxide).toBe(6);
    expect(2 + 2 * alcoholic.carbonDioxide).toBe(6);
  });

  it("releases 2898 kJ aerobically against 150 kJ and 210 kJ in fermentation, as KSSM gives", () => {
    expect(yieldOf("aerobic").energy).toBe(2898);
    expect(yieldOf("lactic").energy).toBe(150);
    expect(yieldOf("alcoholic").energy).toBe(210);
  });

  it("makes the lesson's aerobic ATP total, or only the 2 of glycolysis without oxygen", () => {
    expect(atpMade("aerobic", 32)).toBe(32);
    expect(atpMade("aerobic", 38)).toBe(38);
    expect(atpMade("lactic", 32)).toBe(GLYCOLYSIS_ATP);
    expect(atpMade("alcoholic", 32)).toBe(2);
    expect(atpAtMembrane("aerobic", 32)).toBe(30);
    expect(atpAtMembrane("lactic", 32)).toBe(0);
  });

  it("uses oxygen at the inner membrane, and nowhere without it", () => {
    expect(oxygenSite("aerobic")).toEqual(Option.some("inner"));
    expect(Option.isNone(oxygenSite("lactic"))).toBe(true);
  });
});

describe("the molecules' trips", () => {
  it("moves as many of each molecule as one glucose gives, in every journey", () => {
    for (const condition of ["aerobic", "lactic", "alcoholic"] as const) {
      const given = yieldOf(condition);
      expect(tripsFor(condition, "glucose")).toHaveLength(JOURNEYS);
      expect(tripsFor(condition, "pyruvate")).toHaveLength(2 * JOURNEYS);
      expect(tripsFor(condition, "carbonDioxide")).toHaveLength(
        given.carbonDioxide * JOURNEYS
      );
      expect(tripsFor(condition, "oxygen")).toHaveLength(
        given.oxygen * JOURNEYS
      );
      expect(tripsFor(condition, "water")).toHaveLength(given.water * JOURNEYS);
      expect(tripsFor(condition, "carrier")).toHaveLength(
        given.carriers * JOURNEYS
      );
      expect(tripsFor(condition, "atp")).toHaveLength(
        atpMade(condition, 32) * JOURNEYS
      );
    }
    expect(tripsFor("lactic", "lactate")).toHaveLength(2 * JOURNEYS);
    expect(tripsFor("alcoholic", "ethanol")).toHaveLength(2 * JOURNEYS);
    expect(tripsFor("aerobic", "atp", 38)).toHaveLength(38 * JOURNEYS);
  });

  it("splits glucose in the cytoplasm, where glycolysis makes its 2 ATP", () => {
    for (const trip of tripsFor("aerobic", "glucose")) {
      const [from, to] = ends(trip);
      expect(compartmentOf(from)).toBe("cytoplasm");
      expect(same(to, GLYCOLYSIS)).toBe(true);
    }
    expect(compartmentOf(GLYCOLYSIS)).toBe("cytoplasm");
    const fromGlycolysis = Arr.filter(tripsFor("lactic", "atp"), (trip) =>
      same(ends(trip)[0], GLYCOLYSIS)
    );
    expect(fromGlycolysis).toHaveLength(2 * JOURNEYS);
  });

  it("takes pyruvate into the matrix with oxygen and keeps it in the cytoplasm without", () => {
    for (const trip of tripsFor("aerobic", "pyruvate")) {
      expect(compartmentOf(ends(trip)[1])).toBe("matrix");
    }
    for (const condition of ["lactic", "alcoholic"] as const) {
      for (const trip of tripsFor(condition, "pyruvate")) {
        expect(compartmentOf(ends(trip)[1])).toBe("cytoplasm");
      }
    }
  });

  it("sends carbon dioxide, water and ATP from the matrix out into the cytoplasm", () => {
    for (const molecule of ["carbonDioxide", "water"] as const) {
      for (const trip of tripsFor("aerobic", molecule)) {
        const [from, to] = ends(trip);
        expect(compartmentOf(from)).toBe("matrix");
        expect(compartmentOf(to)).toBe("cytoplasm");
      }
    }
    const membrane = Arr.filter(
      tripsFor("aerobic", "atp"),
      (trip) => !same(ends(trip)[0], GLYCOLYSIS)
    );
    expect(membrane).toHaveLength(30 * JOURNEYS);
    for (const trip of membrane) {
      const [from, to] = ends(trip);
      expect(Arr.some(SYNTHASES, (synthase) => same(synthase.head, from))).toBe(
        true
      );
      expect(compartmentOf(to)).toBe("cytoplasm");
    }
  });

  it("brings oxygen in to where the hydrogen arrives, and forms water there", () => {
    const meetings = Arr.map(
      tripsFor("aerobic", "oxygen"),
      (trip) => ends(trip)[1]
    );
    for (const trip of tripsFor("aerobic", "water")) {
      expect(Arr.some(meetings, (point) => same(point, ends(trip)[0]))).toBe(
        true
      );
    }
    for (const point of meetings) {
      expect(compartmentOf(point)).toBe("matrix");
    }
  });

  it("keeps every fermentation product in the cytoplasm", () => {
    for (const molecule of ["lactate", "ethanol", "carbonDioxide"] as const) {
      for (const trip of tripsFor(
        molecule === "lactate" ? "lactic" : "alcoholic",
        molecule
      )) {
        for (const point of trip.path) {
          expect(compartmentOf(point)).toBe("cytoplasm");
        }
      }
    }
  });

  it("times each step after the one before it", () => {
    const aerobic = tripsOf("aerobic", 32);
    for (const trip of aerobic) {
      expect(trip.start).toBeGreaterThanOrEqual(0);
      expect(trip.end).toBeLessThanOrEqual(1);
      expect(trip.start).toBeLessThan(trip.end);
    }
    const last = (molecule: Molecule) =>
      Arr.reduce(tripsFor("aerobic", molecule), 0, (most, trip) =>
        Math.max(most, trip.end)
      );
    const first = (molecule: Molecule) =>
      Arr.reduce(tripsFor("aerobic", molecule), 1, (least, trip) =>
        Math.min(least, trip.start)
      );
    expect(last("glucose")).toBe(first("pyruvate"));
    // Carbon dioxide and hydrogen form from pyruvate as it settles in the matrix.
    expect(first("carbonDioxide")).toBeGreaterThan(first("pyruvate"));
    expect(first("carbonDioxide")).toBeLessThan(last("pyruvate"));
    expect(first("carrier")).toBeLessThan(last("pyruvate"));
    expect(last("oxygen")).toBe(first("water"));
  });
});

describe("the run of a cycle", () => {
  it("shows a trip only between its start and end, each journey a third of a cycle ahead", () => {
    const glucose = Arr.getUnsafe(tripsFor("aerobic", "glucose"), 0);
    expect(progress(glucose, 0.08).pipe(Option.getOrThrow)).toBeCloseTo(0.5, 9);
    expect(Option.isNone(progress(glucose, 0.5))).toBe(true);
    const later = Arr.getUnsafe(tripsFor("aerobic", "glucose"), 1);
    expect(later.journey).toBe(1);
    expect(progress(later, 2 / 3 + 0.08).pipe(Option.getOrThrow)).toBeCloseTo(
      0.5,
      9
    );
  });

  it("forms and fades each molecule and eases it in and out", () => {
    expect(presence(0)).toBe(0);
    expect(presence(0.05)).toBeCloseTo(0.5, 12);
    expect(presence(0.5)).toBe(1);
    expect(presence(1)).toBe(0);
    expect(ease(0)).toBe(0);
    expect(ease(0.5)).toBe(0.5);
    expect(ease(1)).toBe(1);
  });

  it("pauses on a moment that shows every stage at once", () => {
    const showing = (condition: Condition, molecule: Molecule) =>
      Arr.some(tripsFor(condition, molecule), (trip) =>
        Option.isSome(progress(trip, STILL))
      );
    for (const molecule of [
      "glucose",
      "pyruvate",
      "carbonDioxide",
      "carrier",
      "oxygen",
      "water",
      "atp",
    ] as const) {
      expect([molecule, showing("aerobic", molecule)]).toEqual([
        molecule,
        true,
      ]);
    }
    for (const molecule of ["glucose", "pyruvate", "lactate", "atp"] as const) {
      expect([molecule, showing("lactic", molecule)]).toEqual([molecule, true]);
    }
    expect(showing("alcoholic", "ethanol")).toBe(true);
  });
});
