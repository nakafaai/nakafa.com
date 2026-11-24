// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import type {
  Claim,
  Test,
  Tile,
} from "@repo/design-system/components/contents/mathematics/counterexample/claim";
import {
  caseOf,
  deciderOf,
  firstTest,
  holds,
  passes,
  verdictOf,
  verdictsOf,
} from "@repo/design-system/components/contents/mathematics/counterexample/claim";
import { Array as Arr, Option } from "effect";

/** A number tile. */
function number(value: number): Tile {
  return { kind: "number", value };
}

/** The numbers among `values` that pass a test. */
function passing(test: Test, values: readonly number[]) {
  return Arr.filter(values, (value) => passes(test, number(value)));
}

const ODD = { name: "Odd", test: { kind: "odd" } } as const;
const PRIME = { name: "Prime", test: { kind: "prime" } } as const;
const RED = { name: "Red", test: { kind: "color", color: "red" } } as const;
const SQUARE = {
  name: "Square",
  test: { kind: "shape", shape: "square" },
} as const;
const NUMBERS = Arr.map([1, 2, 3, 4, 5, 9, 15], number);

describe("a test of one tile", () => {
  it("reads the number on a number tile", () => {
    const values = [-3, 0, 1, 2, 4, 9, 12, 15, 16, 17];
    expect(passing({ kind: "odd" }, values)).toEqual([-3, 1, 9, 15, 17]);
    expect(passing({ kind: "even" }, values)).toEqual([0, 2, 4, 12, 16]);
    expect(passing({ kind: "prime" }, values)).toEqual([2, 17]);
    expect(passing({ kind: "square-number" }, values)).toEqual([
      0, 1, 4, 9, 16,
    ]);
    expect(passing({ kind: "multiple", of: 3 }, values)).toEqual([
      -3, 0, 9, 12, 15,
    ]);
    expect(passing({ kind: "multiple", of: 0 }, values)).toEqual([0]);
    expect(passing({ kind: "factor", of: 12 }, values)).toEqual([
      -3, 1, 2, 4, 12,
    ]);
    expect(passing({ kind: "above", than: 9 }, values)).toEqual([
      12, 15, 16, 17,
    ]);
    expect(passing({ kind: "below", than: 2 }, values)).toEqual([-3, 0, 1]);
  });

  it("reads the shape and the paint of a shape tile", () => {
    const redSquare: Tile = { kind: "shape", color: "red", shape: "square" };
    expect(passes(SQUARE.test, redSquare)).toBe(true);
    expect(passes(RED.test, redSquare)).toBe(true);
    expect(passes({ kind: "shape", shape: "circle" }, redSquare)).toBe(false);
    expect(passes({ kind: "color", color: "blue" }, redSquare)).toBe(false);
  });

  it("fails a test made for the other kind of tile", () => {
    const blueCircle: Tile = { kind: "shape", color: "blue", shape: "circle" };
    expect(passes({ kind: "odd" }, blueCircle)).toBe(false);
    expect(passes(RED.test, number(3))).toBe(false);
    expect(passes(SQUARE.test, number(4))).toBe(false);
  });
});

describe("what a tile does to a claim", () => {
  const all: Claim = { kind: "all", predicate: PRIME, subject: ODD };
  const some: Claim = { kind: "some", predicate: PRIME, subject: ODD };
  const implication: Claim = { kind: "if", p: ODD, q: PRIME };

  it("finds a counterexample of all and if, and an example of some", () => {
    expect(verdictOf(all, number(9))).toBe("breaks");
    expect(verdictOf(all, number(3))).toBe("fits");
    expect(verdictOf(all, number(4))).toBe("outside");
    expect(verdictOf(some, number(3))).toBe("proves");
    expect(verdictOf(some, number(9))).toBe("misses");
    expect(verdictOf(some, number(4))).toBe("outside");
    expect(verdictOf(implication, number(9))).toBe("breaks");
    expect(verdictOf(implication, number(3))).toBe("fits");
    expect(verdictOf(implication, number(2))).toBe("safe");
    expect(verdictOf(implication, number(4))).toBe("safe");
  });

  it("treats every tile as a case of a claim with no subject", () => {
    const every: Claim = { kind: "all", predicate: ODD };
    expect(caseOf(every, number(4))).toEqual({ p: true, q: false });
    expect(Option.isNone(firstTest(every))).toBe(true);
    expect(firstTest(implication)).toEqual(Option.some(ODD));
    expect(verdictsOf(every)).toEqual(["breaks", "fits"]);
    expect(verdictsOf({ kind: "some", predicate: ODD })).toEqual([
      "proves",
      "misses",
    ]);
    expect(verdictsOf(all)).toEqual(["breaks", "fits", "outside"]);
    expect(verdictsOf(some)).toEqual(["proves", "misses", "outside"]);
    expect(verdictsOf(implication)).toEqual(["breaks", "fits", "safe"]);
  });
});

describe("whether a claim holds on the table", () => {
  it("is settled by the first counterexample of all and if", () => {
    const all: Claim = { kind: "all", predicate: PRIME, subject: ODD };
    expect(deciderOf(all, NUMBERS)).toEqual(Option.some(0));
    expect(holds(all, NUMBERS)).toBe(false);
    const implication: Claim = { kind: "if", p: PRIME, q: ODD };
    expect(deciderOf(implication, NUMBERS)).toEqual(Option.some(1));
    expect(holds({ kind: "if", p: ODD, q: ODD }, NUMBERS)).toBe(true);
  });

  it("is settled by the first example of some, and false without one", () => {
    const some: Claim = { kind: "some", predicate: PRIME, subject: ODD };
    expect(deciderOf(some, NUMBERS)).toEqual(Option.some(2));
    expect(holds(some, NUMBERS)).toBe(true);
    const none: Claim = {
      kind: "some",
      predicate: { name: "Big", test: { kind: "above", than: 99 } },
    };
    expect(deciderOf(none, NUMBERS)).toEqual(Option.none());
    expect(holds(none, NUMBERS)).toBe(false);
  });
});
