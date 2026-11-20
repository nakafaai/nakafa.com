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
  return { _tag: "number", value };
}

/** The numbers among `values` that pass a test. */
function passing(test: Test, values: readonly number[]) {
  return Arr.filter(values, (value) => passes(test, number(value)));
}

const ODD = { name: "Odd", test: { _tag: "odd" } } as const;
const PRIME = { name: "Prime", test: { _tag: "prime" } } as const;
const RED = { name: "Red", test: { _tag: "colour", colour: "red" } } as const;
const SQUARE = {
  name: "Square",
  test: { _tag: "shape", shape: "square" },
} as const;
const NUMBERS = Arr.map([1, 2, 3, 4, 5, 9, 15], number);

describe("a test of one tile", () => {
  it("reads the number on a number tile", () => {
    const values = [-3, 0, 1, 2, 4, 9, 12, 15, 16, 17];
    expect(passing({ _tag: "odd" }, values)).toEqual([-3, 1, 9, 15, 17]);
    expect(passing({ _tag: "even" }, values)).toEqual([0, 2, 4, 12, 16]);
    expect(passing({ _tag: "prime" }, values)).toEqual([2, 17]);
    expect(passing({ _tag: "square-number" }, values)).toEqual([
      0, 1, 4, 9, 16,
    ]);
    expect(passing({ _tag: "multiple", of: 3 }, values)).toEqual([
      -3, 0, 9, 12, 15,
    ]);
    expect(passing({ _tag: "multiple", of: 0 }, values)).toEqual([0]);
    expect(passing({ _tag: "factor", of: 12 }, values)).toEqual([
      -3, 1, 2, 4, 12,
    ]);
    expect(passing({ _tag: "above", than: 9 }, values)).toEqual([
      12, 15, 16, 17,
    ]);
    expect(passing({ _tag: "below", than: 2 }, values)).toEqual([-3, 0, 1]);
  });

  it("reads the shape and the paint of a shape tile", () => {
    const redSquare: Tile = { _tag: "shape", colour: "red", shape: "square" };
    expect(passes(SQUARE.test, redSquare)).toBe(true);
    expect(passes(RED.test, redSquare)).toBe(true);
    expect(passes({ _tag: "shape", shape: "circle" }, redSquare)).toBe(false);
    expect(passes({ _tag: "colour", colour: "blue" }, redSquare)).toBe(false);
  });

  it("fails a test made for the other kind of tile", () => {
    const blueCircle: Tile = { _tag: "shape", colour: "blue", shape: "circle" };
    expect(passes({ _tag: "odd" }, blueCircle)).toBe(false);
    expect(passes(RED.test, number(3))).toBe(false);
    expect(passes(SQUARE.test, number(4))).toBe(false);
  });
});

describe("what a tile does to a claim", () => {
  const all: Claim = { _tag: "all", predicate: PRIME, subject: ODD };
  const some: Claim = { _tag: "some", predicate: PRIME, subject: ODD };
  const implication: Claim = { _tag: "if", p: ODD, q: PRIME };

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
    const every: Claim = { _tag: "all", predicate: ODD };
    expect(caseOf(every, number(4))).toEqual({ p: true, q: false });
    expect(Option.isNone(firstTest(every))).toBe(true);
    expect(firstTest(implication)).toEqual(Option.some(ODD));
    expect(verdictsOf(every)).toEqual(["breaks", "fits"]);
    expect(verdictsOf({ _tag: "some", predicate: ODD })).toEqual([
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
    const all: Claim = { _tag: "all", predicate: PRIME, subject: ODD };
    expect(deciderOf(all, NUMBERS)).toEqual(Option.some(0));
    expect(holds(all, NUMBERS)).toBe(false);
    const implication: Claim = { _tag: "if", p: PRIME, q: ODD };
    expect(deciderOf(implication, NUMBERS)).toEqual(Option.some(1));
    expect(holds({ _tag: "if", p: ODD, q: ODD }, NUMBERS)).toBe(true);
  });

  it("is settled by the first example of some, and false without one", () => {
    const some: Claim = { _tag: "some", predicate: PRIME, subject: ODD };
    expect(deciderOf(some, NUMBERS)).toEqual(Option.some(2));
    expect(holds(some, NUMBERS)).toBe(true);
    const none: Claim = {
      _tag: "some",
      predicate: { name: "Big", test: { _tag: "above", than: 99 } },
    };
    expect(deciderOf(none, NUMBERS)).toEqual(Option.none());
    expect(holds(none, NUMBERS)).toBe(false);
  });
});
