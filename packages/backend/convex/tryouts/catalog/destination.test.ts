import { describe, expect, it } from "@effect/vitest";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  readActiveTryoutRestartTarget,
  readTryoutDestinationPaths,
} from "@repo/backend/convex/tryouts/catalog/destination";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout/snapshot";
import {
  activateTryoutStartSource,
  makeTryoutStartHierarchy,
  makeTryoutStartPlacement,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_SECTION,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout/source";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const identity = {
  countryKey: TRYOUT_START_COUNTRY,
  examKey: TRYOUT_START_EXAM,
  locale: "id" as const,
  setKey: TRYOUT_START_SET,
  trackKey: TRYOUT_START_TRACK,
};
const setPath = `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}/${TRYOUT_START_SET}`;
const sectionPath = `${setPath}/${TRYOUT_START_SECTION}`;

describe("signed try-out attempt destinations", () => {
  it.effect(
    "distinguishes canonical, absent, and conflicting requested routes",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) => activateTryoutStartSource(ctx, "visible"))
        );
        for (const [requestedSectionPublicPath, requestedSectionMatches] of [
          [sectionPath, true],
          [setPath, false],
          [`${sectionPath}-missing`, null],
        ] as const) {
          const result = yield* Effect.promise(() =>
            t.query((ctx) =>
              runConvexProgram(
                readTryoutDestinationPaths(ctx, {
                  ...identity,
                  requestedSectionPublicPath,
                  sectionKey: TRYOUT_START_SECTION,
                })
              )
            )
          );
          expect(result).toEqual({
            activeSectionPublicPath: sectionPath,
            activeSetPublicPath: setPath,
            requestedSectionMatches,
          });
        }
        const absentSection = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(
              readTryoutDestinationPaths(ctx, {
                ...identity,
                requestedSectionPublicPath: sectionPath,
                sectionKey: "missing-section",
              })
            )
          )
        );
        expect(absentSection).toEqual({
          activeSectionPublicPath: null,
          activeSetPublicPath: setPath,
          requestedSectionMatches: false,
        });
        const absentSet = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(
              readTryoutDestinationPaths(ctx, {
                ...identity,
                requestedSectionPublicPath: sectionPath,
                setKey: "missing-set",
              })
            )
          )
        );
        expect(absentSet).toEqual({
          activeSectionPublicPath: null,
          activeSetPublicPath: null,
          requestedSectionMatches: null,
        });
      })
  );

  it.effect(
    "restarts through the signed internal entry or first visible section",
    () =>
      Effect.gen(function* () {
        for (const visibility of ["visible", "internal-entry"] as const) {
          const t = convexTest(schema, convexModules);
          yield* Effect.promise(() =>
            t.mutation((ctx) => activateTryoutStartSource(ctx, visibility))
          );
          const result = yield* Effect.promise(() =>
            t.query((ctx) =>
              runConvexProgram(readActiveTryoutRestartTarget(ctx, identity))
            )
          );
          expect(result).toMatchObject({
            entrySection: { sectionKey: TRYOUT_START_SECTION, visibility },
            setPublicPath: setPath,
          });
          const missing = yield* Effect.promise(() =>
            t.query((ctx) =>
              runConvexProgram(
                readActiveTryoutRestartTarget(ctx, {
                  ...identity,
                  setKey: "missing-set",
                })
              )
            )
          );
          expect(missing).toBeNull();
        }
      })
  );

  it.effect(
    "does not invent a restart target when a visible set has no visible entry",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            activateTryoutSnapshot(ctx, {
              catalog: makeTryoutStartHierarchy("id", "visible").map((row) =>
                row.kind === "section"
                  ? {
                      ...row,
                      publicPath: undefined,
                      visibility: "internal-entry",
                    }
                  : row
              ),
              placements: [makeTryoutStartPlacement("id")],
            })
          )
        );
        const result = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(readActiveTryoutRestartTarget(ctx, identity))
          )
        );
        expect(result).toBeNull();
      })
  );

  it.effect(
    "rejects a changed indexed kind before projecting any destination",
    () =>
      Effect.gen(function* () {
        for (const kind of ["set", "section"] as const) {
          const t = convexTest(schema, convexModules);
          const fixture = yield* Effect.promise(() =>
            t.mutation((ctx) => activateTryoutStartSource(ctx, "visible"))
          );
          yield* Effect.promise(() =>
            t.mutation(async (ctx) => {
              const row = await ctx.db
                .query("tryoutCatalog")
                .withIndex("by_snapshotId_and_identity", (index) =>
                  index
                    .eq("snapshotId", fixture.snapshotId)
                    .eq(
                      "identity",
                      kind === "set"
                        ? fixture.setIdentity
                        : fixture.sectionIdentity
                    )
                )
                .unique();
              if (row) {
                await ctx.db.patch(row._id, { kind: "country" });
              }
            })
          );
          yield* Effect.promise(() =>
            expect(
              t.query((ctx) =>
                runConvexProgram(
                  readTryoutDestinationPaths(ctx, {
                    ...identity,
                    sectionKey: TRYOUT_START_SECTION,
                  })
                )
              )
            ).rejects.toMatchObject({
              data: {
                code: "CONTENT_RELEASE_INTEGRITY",
                message: expect.stringContaining("indexed facts"),
              },
            })
          );
        }
      })
  );
});
