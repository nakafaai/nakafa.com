import { describe, expect, it } from "@effect/vitest";
import { convexTryoutLayer } from "@repo/backend/content/tryout/convex";
import { readTryoutReference } from "@repo/backend/content/tryout/reference";
import { resolveReferenceInput } from "@repo/backend/convex/contentRelease/reference/input";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout/snapshot";
import {
  makeTryoutStartHierarchy,
  makeTryoutStartPlacement,
} from "@repo/backend/test/tryout/source";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("try-out reference visibility", () => {
  it.effect(
    "does not invent a route for absent ownership, an absent asset, or an internal entry",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const catalog = makeTryoutStartHierarchy("id", "internal-entry");
        const section = catalog.find((row) => row.kind === "section");
        if (section === undefined) {
          return yield* Effect.die("Expected a technical section.");
        }
        const input = yield* resolveReferenceInput({
          kind: "content",
          contentId: section.graph.assetId,
        });
        if (input === null) {
          return yield* Effect.die("Expected a classified try-out asset.");
        }
        expect(
          yield* Effect.promise(() =>
            t.query((ctx) =>
              runConvexProgram(
                readTryoutReference(input).pipe(
                  Effect.provide(convexTryoutLayer(ctx))
                )
              )
            )
          )
        ).toBeNull();
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            activateTryoutSnapshot(ctx, {
              catalog,
              placements: [makeTryoutStartPlacement("id")],
            })
          )
        );
        expect(
          yield* Effect.promise(() =>
            t.query((ctx) =>
              runConvexProgram(
                readTryoutReference(input).pipe(
                  Effect.provide(convexTryoutLayer(ctx))
                )
              )
            )
          )
        ).toBeNull();
        const absent = yield* resolveReferenceInput({
          kind: "content",
          contentId: `${section.graph.assetId}:absent`,
        });
        if (absent === null) {
          return yield* Effect.die(
            "Expected a classified absent try-out asset."
          );
        }
        expect(
          yield* Effect.promise(() =>
            t.query((ctx) =>
              runConvexProgram(
                readTryoutReference(absent).pipe(
                  Effect.provide(convexTryoutLayer(ctx))
                )
              )
            )
          )
        ).toBeNull();
      })
  );
});
