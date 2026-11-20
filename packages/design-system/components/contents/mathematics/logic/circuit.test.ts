// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  baseOf,
  carries,
  LAYOUTS,
  lampLit,
  type PartName,
  postAt,
  stackOf,
} from "@repo/design-system/components/contents/mathematics/logic/circuit";
import {
  BOARD,
  PARTS,
} from "@repo/design-system/components/contents/mathematics/logic/rig";
import {
  casesOf,
  LogicModeSchema,
  truthOf,
} from "@repo/design-system/components/contents/mathematics/logic/truth";
import { Array as Arr } from "effect";

describe("the circuit board", () => {
  it("stands every part on its own base", () => {
    expect(baseOf("p")).toBe(PARTS.switch);
    expect(baseOf("q")).toBe(PARTS.switch);
    expect(baseOf("lamp")).toBe(PARTS.lamp);
    expect(baseOf("battery")).toBe(PARTS.battery);
  });

  it("finds a post along a part's length, turned as three.js turns it", () => {
    const flat = { at: [0.1, 0.2] as const, turn: 0 };
    expect(postAt(flat, { part: "p", side: "a" })).toEqual([0.07, 0.2]);
    const [x, z] = postAt(
      { at: [0, 0], turn: -Math.PI / 2 },
      { part: "lamp", side: "a" }
    );
    expect(x).toBeCloseTo(0);
    expect(z).toBeCloseTo(-PARTS.lamp.reach);
  });

  it("runs every lead between the posts of parts the layout places, on the board", () => {
    for (const mode of LogicModeSchema.literals) {
      const layout = LAYOUTS[mode];
      for (const lead of layout.leads) {
        for (const terminal of [lead.from, lead.to]) {
          expect(
            Arr.some(layout.parts, (part) => part.name === terminal.part)
          ).toBe(true);
        }
        for (const [x, z] of [lead.start, lead.end, ...lead.via]) {
          expect(Math.abs(x)).toBeLessThan(BOARD.width / 2);
          expect(Math.abs(z)).toBeLessThan(BOARD.depth / 2);
        }
      }
    }
    const names = (mode: "and" | "not") =>
      Arr.map(LAYOUTS[mode].parts, (part) => part.name);
    expect(names("not")).not.toContain("q");
    expect(names("and")).not.toContain("resistor");
  });

  it("carries current along a lead only while its switches let it", () => {
    const open = { p: false, q: false };
    const onlyP = { p: true, q: false };
    expect(carries("always", open)).toBe(true);
    expect(carries("p", onlyP)).toBe(true);
    expect(carries("q", onlyP)).toBe(false);
    expect(carries("both", onlyP)).toBe(false);
    expect(carries("either", onlyP)).toBe(true);
    expect(carries("either", open)).toBe(false);
  });

  it("lets no current stop at a part: a live lead in means a live lead out", () => {
    const parts: readonly PartName[] = [
      "battery",
      "p",
      "q",
      "lamp",
      "resistor",
    ];
    for (const mode of LogicModeSchema.literals) {
      for (const state of casesOf(mode)) {
        const live = Arr.filter(LAYOUTS[mode].leads, (lead) =>
          carries(lead.flow, state)
        );
        for (const part of parts) {
          const into = Arr.filter(live, (lead) => lead.to.part === part);
          const out = Arr.filter(live, (lead) => lead.from.part === part);
          expect(into.length > 0).toBe(out.length > 0);
        }
      }
    }
  });

  it("lights the lamp exactly when the compound is true", () => {
    for (const mode of LogicModeSchema.literals) {
      for (const state of casesOf(mode)) {
        expect(lampLit(LAYOUTS[mode], state)).toBe(truthOf(mode, state));
      }
    }
  });

  it("stacks the clips of leads that share a post, the earlier lower", () => {
    expect(stackOf(LAYOUTS.or, 0, "from")).toBe(0);
    expect(stackOf(LAYOUTS.or, 1, "from")).toBe(1);
    expect(stackOf(LAYOUTS.or, 3, "to")).toBe(1);
    expect(stackOf(LAYOUTS.not, 4, "from")).toBe(1);
    expect(stackOf(LAYOUTS.and, 2, "to")).toBe(0);
  });
});
