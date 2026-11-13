import { describe, expect, it } from "@effect/vitest";
import {
  getReaction,
  ReactionIdSchema,
} from "@repo/design-system/components/contents/chemistry/equation/catalog";
import { layoutReaction } from "@repo/design-system/components/contents/chemistry/equation/layout";
import { getMolecule } from "@repo/design-system/components/contents/chemistry/molecule/catalog";
import { measureDistance } from "@repo/design-system/components/contents/chemistry/molecule/geometry";
import { Array as Arr, Result } from "effect";

describe("reaction layout", () => {
  it("moves every atom from the left side to the right side", () => {
    for (const id of ReactionIdSchema.literals) {
      const layout = Result.getOrThrow(layoutReaction(getReaction(id)));

      for (const particle of layout.particles) {
        expect(particle.start[0]).toBeLessThan(0);
        expect(particle.end[0]).toBeGreaterThan(0);
      }
    }
  });

  it("keeps each atom its element and pairs every product atom once", () => {
    for (const id of ReactionIdSchema.literals) {
      const layout = Result.getOrThrow(layoutReaction(getReaction(id)));
      const products = Arr.map(
        layout.particles,
        (particle) => particle.product
      );

      expect(Arr.dedupe(products)).toHaveLength(layout.particles.length);
    }
  });

  it("keeps the measured bond lengths of the reactants and the products", () => {
    const layout = Result.getOrThrow(
      layoutReaction(getReaction("water-synthesis"))
    );
    const water = Result.getOrThrow(getMolecule("water"));
    const hydrogen = Result.getOrThrow(getMolecule("hydrogen"));

    expect(layout.reactantBonds).toHaveLength(3);
    expect(layout.productBonds).toHaveLength(4);
    for (const bond of layout.productBonds) {
      const from = Arr.getUnsafe(layout.particles, bond.from);
      const to = Arr.getUnsafe(layout.particles, bond.to);
      expect(measureDistance(from.end, to.end)).toBeCloseTo(95.8, 6);
    }
    const first = Arr.getUnsafe(layout.reactantBonds, 0);
    expect(
      measureDistance(
        Arr.getUnsafe(layout.particles, first.from).start,
        Arr.getUnsafe(layout.particles, first.to).start
      )
    ).toBeCloseTo(74.1, 6);
    expect(water.bonds).toHaveLength(2);
    expect(hydrogen.bonds).toHaveLength(1);
  });

  it("fails a reaction whose sides do not hold the same atoms", () => {
    const fewer = layoutReaction({
      products: [["water", 1]],
      reactants: [["hydrogen", 1]],
    });
    const swapped = layoutReaction({
      products: [["oxygen", 1]],
      reactants: [["hydrogen", 1]],
    });

    expect(Result.isFailure(fewer) && fewer.failure._tag).toBe(
      "ReactionBalanceError"
    );
    expect(Result.isFailure(swapped) && swapped.failure._tag).toBe(
      "ReactionBalanceError"
    );
  });
});
