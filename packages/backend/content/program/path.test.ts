import { describe, expect, it } from "@effect/vitest";
import { convexProgramLayer } from "@repo/backend/content/program/convex";
import { readProgramPath } from "@repo/backend/content/program/path";
import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
} from "@repo/backend/test/program/snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("contentRelease/program/path", () => {
  it.live("distinguishes unmanaged, active, and managed-missing paths", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);

      yield* Effect.promise(() =>
        expect(
          target.query((ctx) =>
            runConvexProgram(
              readProgramPath("en", "curriculum/technical-program-1").pipe(
                Effect.provide(convexProgramLayer(ctx))
              )
            )
          )
        ).resolves.toEqual({ managed: false, routeJson: null })
      );

      const data = yield* makeProgramSnapshotData();
      yield* Effect.promise(() => activateProgramSnapshot(target, data));
      const active = yield* Effect.promise(() =>
        target.query((ctx) =>
          runConvexProgram(
            readProgramPath("en", "curriculum/technical-program-1").pipe(
              Effect.provide(convexProgramLayer(ctx))
            )
          )
        )
      );
      const decoded = yield* decodeSnapshotRowJson(active.routeJson ?? "");

      expect(active.managed).toBe(true);
      expect(decoded).toMatchObject({
        family: "program",
        record: {
          kind: "curriculum",
          row: { publicPath: "curriculum/technical-program-1" },
        },
      });
      yield* Effect.promise(() =>
        expect(
          target.query((ctx) =>
            runConvexProgram(
              readProgramPath("en", "curriculum/deleted").pipe(
                Effect.provide(convexProgramLayer(ctx))
              )
            )
          )
        ).resolves.toEqual({ managed: true, routeJson: null })
      );
    })
  );

  it.live("rejects indexed curriculum identity drift", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData();
      const target = convexTest(schema, convexModules);
      yield* Effect.promise(() => activateProgramSnapshot(target, data));
      yield* Effect.promise(() =>
        target.mutation(async (ctx) => {
          const route = await ctx.db
            .query("curriculumRoutes")
            .withIndex("by_snapshotId_and_appLocale_and_path", (query) =>
              query
                .eq("snapshotId", data.snapshotId)
                .eq("appLocale", "en")
                .eq("path", "curriculum/technical-program-1")
            )
            .unique();
          if (!route) {
            throw new Error("Expected one curriculum route.");
          }
          await ctx.db.patch("curriculumRoutes", route._id, {
            programKey: "tampered-program",
          });
        })
      );

      yield* Effect.promise(() =>
        expect(
          target.query((ctx) =>
            runConvexProgram(
              readProgramPath("en", "curriculum/technical-program-1").pipe(
                Effect.provide(convexProgramLayer(ctx))
              )
            )
          )
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
    })
  );
});
