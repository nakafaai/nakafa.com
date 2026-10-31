import { assert, describe, expect, it } from "@effect/vitest";
import { resolveReferenceInput } from "@repo/backend/confect/contentRelease/reference/input";
import type { ContentReferenceInput } from "@repo/backend/confect/contentRelease/reference/spec";
import { readTryoutReference } from "@repo/backend/content/tryout/reference";
import { type TryoutWorld, tryoutWorld } from "@repo/backend/test/tryout/world";
import { Effect, Struct } from "effect";

/** Resolves one reference the way the reference reader does, then reads its try-out entry. */
const read = (world: TryoutWorld, input: ContentReferenceInput) =>
  Effect.gen(function* () {
    const resolved = yield* resolveReferenceInput(input);
    assert.ok(resolved, "Expected a try-out reference.");
    return yield* world.run(readTryoutReference(resolved));
  });

describe("content/tryout/reference", () => {
  it.effect(
    "resolves a public route or a graph asset to its search document, with the row's description",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        expect(
          yield* read(world, {
            appLocale: "en",
            kind: "route",
            publicPath: "try-out/indonesia-en",
          })
        ).toMatchObject({
          description: "Try-out Indonesia",
          locale: "en",
          route: "try-out/indonesia-en",
          title: "Try-out",
        });
        expect(
          yield* read(world, {
            contentId: "asset:id:tryout:set-1",
            kind: "content",
          })
        ).toMatchObject({
          description: "",
          route: "try-out/indonesia/snbt/2027/set-1-id",
        });
        expect(
          yield* read(world, {
            appLocale: "id",
            kind: "route",
            publicPath: "try-out/nowhere",
          })
        ).toBeNull();
      })
  );

  it.effect("finds no route for an internal entry or an absent asset", () =>
    Effect.gen(function* () {
      const world = yield* tryoutWorld({ entry: true });
      for (const contentId of [
        "asset:id:tryout:set-1-section-a",
        "asset:id:tryout:absent",
      ]) {
        expect(yield* read(world, { contentId, kind: "content" })).toBeNull();
      }
    })
  );

  it.effect("fails closed when two rows hold one graph asset", () =>
    Effect.gen(function* () {
      const world = yield* tryoutWorld();
      yield* Effect.promise(() =>
        world.t.mutation(async (ctx) => {
          const row = await ctx.db
            .query("assessmentRows")
            .withIndex("by_snapshotId_and_appLocale_and_assetId", (query) =>
              query
                .eq("snapshotId", world.snapshotId)
                .eq("appLocale", "id")
                .eq("assetId", "asset:id:tryout:country")
            )
            .unique();
          assert.ok(row);
          await ctx.db.insert("assessmentRows", {
            ...Struct.omit(row, ["_creationTime", "_id"]),
            identity: `${row.identity}-copy`,
          });
        })
      );
      const resolved = yield* resolveReferenceInput({
        contentId: "asset:id:tryout:country",
        kind: "content",
      });
      assert.ok(resolved);
      expect(
        yield* world.run(
          readTryoutReference(resolved).pipe(
            Effect.flip,
            Effect.map(({ code }) => code)
          )
        )
      ).toBe("CONTENT_RELEASE_INTEGRITY");
    })
  );
});
