import { describe, expect, it } from "@effect/vitest";
import {
  RelationError,
  resolveRelation,
} from "@repo/design-system/components/contents/mathematics/function/relation";
import { Effect } from "effect";

describe("relation arrows", () => {
  it.effect(
    "keeps shared element names in separate sets and preserves every mapping",
    () =>
      Effect.gen(function* () {
        const relation = yield* resolveRelation({
          domain: ["x", "y"],
          codomain: ["y", "x", "z"],
          mappings: [
            { from: "x", to: "x" },
            { from: "x", to: "z" },
            { from: "x", to: "x" },
          ],
        });
        expect(relation.domain).toEqual([
          { id: "x", x: -3, y: 1, z: 0 },
          { id: "y", x: -3, y: -1, z: 0 },
        ]);
        expect(relation.mappings[0]).toEqual({
          id: "mapping-0",
          domainIndex: 0,
          codomainIndex: 1,
          points: [
            { x: -2.5, y: 1, z: 0 },
            { x: 2.5, y: 0, z: 0 },
          ],
        });
        expect(relation.mappings[1].points[1].y).toBeCloseTo(-4 / 3);
        expect(relation.mappings).toHaveLength(3);
        expect(relation.mappings[2].id).not.toBe(relation.mappings[0].id);
      })
  );
  it.effect("allows the empty relation and unpaired elements", () =>
    Effect.gen(function* () {
      expect(
        yield* resolveRelation({ domain: [], codomain: [], mappings: [] })
      ).toEqual({ domain: [], codomain: [], mappings: [] });
      const relation = yield* resolveRelation({
        domain: ["a"],
        codomain: ["b"],
        mappings: [],
      });
      expect(relation.domain[0].y).toBe(0);
      expect(relation.mappings).toEqual([]);
    })
  );
  it.effect.each([
    { domain: ["a", "a"], codomain: ["b"], mappings: [] },
    { domain: ["a"], codomain: ["b", "b"], mappings: [] },
    { domain: ["a"], codomain: ["b"], mappings: [{ from: "absent", to: "b" }] },
    { domain: ["a"], codomain: ["b"], mappings: [{ from: "a", to: "absent" }] },
  ])("rejects ambiguous or missing mapping identities: %j", (input) =>
    Effect.gen(function* () {
      expect(yield* Effect.flip(resolveRelation(input))).toBeInstanceOf(
        RelationError
      );
    })
  );
});
