import { describe, expect, it } from "@effect/vitest";
import { groupPathOf, leafPaths } from "@repo/backend/scripts/refs/paths";
import { Effect } from "effect";

describe("groupPathOf", () => {
  it.effect("derives the group path from a leaf import", () =>
    Effect.gen(function* () {
      expect(yield* groupPathOf("../nina/turns.spec")).toEqual([
        "nina",
        "turns",
      ]);
      expect(yield* groupPathOf("../storage.spec")).toEqual(["storage"]);
      expect(
        yield* groupPathOf("../classes/forums/mutations/posts.spec")
      ).toEqual(["classes", "forums", "mutations", "posts"]);
    })
  );

  it.effect("rejects an import that is not a spec one folder above", () =>
    Effect.gen(function* () {
      for (const specifier of [
        "./nina/turns.spec",
        "../../nina/turns.spec",
        "../nina/turns",
        "../nina//turns.spec",
        "../.spec",
      ]) {
        expect(yield* groupPathOf(specifier).pipe(Effect.flip)).toMatchObject({
          _tag: "RefsSourceError",
          message: expect.stringContaining(specifier),
        });
      }
    })
  );
});

describe("leafPaths", () => {
  it.effect(
    "returns each leaf with the group path that its nesting gives",
    () =>
      Effect.gen(function* () {
        expect(
          yield* leafPaths([
            {
              localName: "nina_turns",
              nestedSegments: ["nina", "turns"],
              specifier: "../nina/turns.spec",
            },
          ])
        ).toEqual([
          {
            localName: "nina_turns",
            segments: ["nina", "turns"],
            specifier: "../nina/turns.spec",
          },
        ]);
      })
  );

  it.effect(
    "fails with both group paths when the file and the nesting differ",
    () =>
      Effect.gen(function* () {
        expect(
          yield* leafPaths([
            {
              localName: "nina_turns",
              nestedSegments: ["nina", "other"],
              specifier: "../nina/turns.spec",
            },
          ]).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "RefsNestingError",
          derivedPath: "nina.turns",
          nestedPath: "nina.other",
          specifier: "../nina/turns.spec",
        });
      })
  );
});
