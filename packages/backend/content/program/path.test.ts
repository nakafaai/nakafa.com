import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { decodeSnapshotRowJson } from "@repo/backend/confect/contentRelease/parse";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { programLayer } from "@repo/backend/content/program/confect";
import { readProgramPath } from "@repo/backend/content/program/path";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
} from "@repo/backend/test/program/snapshot";
import { Effect } from "effect";

describe("contentRelease/program/path", () => {
  it.live("distinguishes unmanaged, active, and managed-missing paths", () =>
    Effect.gen(function* () {
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* target.run(
        Effect.gen(function* () {
          const _targetCtx = yield* MutationCtx;
          expect(
            yield* readProgramPath("en", "curriculum/technical-program-1").pipe(
              Effect.provide(programLayer)
            )
          ).toEqual({
            managed: false,
            routeJson: null,
          });
          const data = yield* makeProgramSnapshotData();
          yield* activateProgramSnapshot(data);
          const active = yield* readProgramPath(
            "en",
            "curriculum/technical-program-1"
          ).pipe(Effect.provide(programLayer));
          const decoded = yield* decodeSnapshotRowJson(active.routeJson ?? "");
          expect(active.managed).toBe(true);
          expect(decoded).toMatchObject({
            family: "program",
            record: {
              kind: "curriculum",
              row: {
                publicPath: "curriculum/technical-program-1",
              },
            },
          });
          expect(
            yield* readProgramPath("en", "curriculum/deleted").pipe(
              Effect.provide(programLayer)
            )
          ).toEqual({
            managed: true,
            routeJson: null,
          });
        })
      );
    })
  );
  it.live("rejects indexed curriculum identity drift", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData();
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* target.run(
        Effect.gen(function* () {
          const targetCtx = yield* MutationCtx;
          yield* activateProgramSnapshot(data);
          yield* Effect.gen(function* () {
            const route = yield* Effect.promise(() =>
              targetCtx.db
                .query("curriculumRoutes")
                .withIndex("by_snapshotId_and_appLocale_and_path", (query) =>
                  query
                    .eq("snapshotId", data.snapshotId)
                    .eq("appLocale", "en")
                    .eq("path", "curriculum/technical-program-1")
                )
                .unique()
            );
            if (!route) {
              throw new Error("Expected one curriculum route.");
            }
            yield* Effect.promise(() =>
              targetCtx.db.patch("curriculumRoutes", route._id, {
                programKey: "tampered-program",
              })
            );
          });
          expect(
            yield* readProgramPath("en", "curriculum/technical-program-1").pipe(
              Effect.provide(programLayer),
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        })
      );
    })
  );
});
