import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  readActiveTryoutRestartTarget,
  readTryoutDestinationPaths,
} from "@repo/backend/confect/tryouts/catalog/destination";
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
import { Array as Arr, Effect } from "effect";

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
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            yield* Effect.promise(() =>
              activateTryoutStartSource(tCtx, "visible")
            );
            for (const [
              requestedSectionPublicPath,
              requestedSectionMatches,
            ] of [
              [sectionPath, true],
              [setPath, false],
              [`${sectionPath}-missing`, null],
            ] as const) {
              const result = yield* readTryoutDestinationPaths({
                ...identity,
                requestedSectionPublicPath,
                sectionKey: TRYOUT_START_SECTION,
              });
              expect(result).toEqual({
                activeSectionPublicPath: sectionPath,
                activeSetPublicPath: setPath,
                requestedSectionMatches,
              });
            }
            const absentSection = yield* readTryoutDestinationPaths({
              ...identity,
              requestedSectionPublicPath: sectionPath,
              sectionKey: "missing-section",
            });
            expect(absentSection).toEqual({
              activeSectionPublicPath: null,
              activeSetPublicPath: setPath,
              requestedSectionMatches: false,
            });
            const absentSet = yield* readTryoutDestinationPaths({
              ...identity,
              requestedSectionPublicPath: sectionPath,
              setKey: "missing-set",
            });
            expect(absentSet).toEqual({
              activeSectionPublicPath: null,
              activeSetPublicPath: null,
              requestedSectionMatches: null,
            });
          })
        );
      })
  );
  it.effect(
    "restarts through the signed internal entry or first visible section",
    () =>
      Effect.gen(function* () {
        for (const visibility of ["visible", "internal-entry"] as const) {
          const t = yield* Confect.pipe(Effect.provide(confectLayer));
          yield* t.run(
            Effect.gen(function* () {
              const tCtx = yield* MutationCtx;
              yield* Effect.promise(() =>
                activateTryoutStartSource(tCtx, visibility)
              );
              const result = yield* readActiveTryoutRestartTarget(identity);
              expect(result).toMatchObject({
                entrySection: {
                  sectionKey: TRYOUT_START_SECTION,
                  visibility,
                },
                setPublicPath: setPath,
              });
              const missing = yield* readActiveTryoutRestartTarget({
                ...identity,
                setKey: "missing-set",
              });
              expect(missing).toBeNull();
            })
          );
        }
      })
  );
  it.effect(
    "does not invent a restart target when a visible set has no visible entry",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            yield* Effect.promise(() =>
              activateTryoutSnapshot(tCtx, {
                catalog: Arr.map(
                  makeTryoutStartHierarchy("id", "visible"),
                  (row) =>
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
            );
            const result = yield* readActiveTryoutRestartTarget(identity);
            expect(result).toBeNull();
          })
        );
      })
  );
  it.effect(
    "rejects a changed indexed kind before projecting any destination",
    () =>
      Effect.gen(function* () {
        for (const kind of ["set", "section"] as const) {
          const t = yield* Confect.pipe(Effect.provide(confectLayer));
          yield* t.run(
            Effect.gen(function* () {
              const tCtx = yield* MutationCtx;
              const fixture = yield* Effect.promise(() =>
                activateTryoutStartSource(tCtx, "visible")
              );
              const row = yield* Effect.promise(() =>
                tCtx.db
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
                  .unique()
              );
              if (row) {
                yield* Effect.promise(() =>
                  tCtx.db.patch(row._id, {
                    kind: "country",
                  })
                );
              }
              expect(
                yield* readTryoutDestinationPaths({
                  ...identity,
                  sectionKey: TRYOUT_START_SECTION,
                }).pipe(Effect.flip)
              ).toMatchObject({
                code: "CONTENT_RELEASE_INTEGRITY",
                message: expect.stringContaining("indexed facts"),
              });
            })
          );
        }
      })
  );
});
