import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { decodeSnapshotRowJson } from "@repo/backend/confect/contentRelease/parse";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { readProgramCatalog } from "@repo/backend/content/program/catalog";
import { programLayer } from "@repo/backend/content/program/confect";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content/release";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
  makeTechnicalProgram,
} from "@repo/backend/test/program/snapshot";
import { Effect } from "effect";

describe("contentRelease/program/catalog", () => {
  it.effect(
    "retains an exam-domain program without inventing a curriculum root",
    () =>
      Effect.gen(function* () {
        const program = makeTechnicalProgram(1, "admission-exam");
        const data = yield* makeProgramSnapshotData([
          {
            ...program,
            navigation: {
              ...program.navigation,
              model: "exam-domain-set",
            },
          },
        ]);
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const _tCtx = yield* MutationCtx;
            yield* activateProgramSnapshot(data);
            const result = yield* readProgramCatalog("en").pipe(
              Effect.provide(programLayer)
            );
            expect(result).toMatchObject({
              managed: true,
              programJson: [expect.any(String)],
              routeJson: [],
            });
          })
        );
      })
  );
  it.effect(
    "returns an empty unmanaged catalog before program publication",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const _tCtx = yield* MutationCtx;
            expect(
              yield* readProgramCatalog("en").pipe(Effect.provide(programLayer))
            ).toMatchObject({
              managed: false,
              programJson: [],
              routeJson: [],
              sourceRevision: null,
            });
          })
        );
      })
  );
  it.live(
    "returns verified programs and localized root routes in source order",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const _tCtx = yield* MutationCtx;
            yield* activateProgramSnapshot(data);
            const result = yield* readProgramCatalog("id").pipe(
              Effect.provide(programLayer)
            );
            const programs = yield* Effect.forEach(
              result.programJson,
              decodeSnapshotRowJson
            );
            const routes = yield* Effect.forEach(
              result.routeJson,
              decodeSnapshotRowJson
            );
            expect(result).toMatchObject({
              activeManifestHash: TEST_MANIFEST_HASH,
              activeReleaseId: TEST_RELEASE_ID,
              managed: true,
              snapshotId: data.snapshotId,
              sourceRevision: "a".repeat(40),
            });
            expect(programs).toMatchObject([
              {
                family: "program",
                record: {
                  kind: "program",
                  row: {
                    key: "technical-program-1",
                  },
                },
              },
              {
                family: "program",
                record: {
                  kind: "program",
                  row: {
                    key: "technical-program-2",
                  },
                },
              },
            ]);
            expect(routes).toMatchObject([
              {
                family: "program",
                record: {
                  kind: "curriculum",
                  row: {
                    publicPath: "kurikulum/program-teknis-1",
                  },
                },
              },
              {
                family: "program",
                record: {
                  kind: "curriculum",
                  row: {
                    publicPath: "kurikulum/program-teknis-2",
                  },
                },
              },
            ]);
          })
        );
      })
  );
  it.live("rejects a root route whose program row disappeared", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData();
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* activateProgramSnapshot(data);
          const program = yield* Effect.promise(() =>
            tCtx.db
              .query("programCatalog")
              .withIndex("by_snapshotId_and_programKey", (index) =>
                index
                  .eq("snapshotId", data.snapshotId)
                  .eq("programKey", "technical-program-1")
              )
              .unique()
          );
          if (!program) {
            throw new Error("Expected one technical program.");
          }
          yield* Effect.promise(() => tCtx.db.delete(program._id));
          expect(
            yield* readProgramCatalog("en").pipe(
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
  it.live("rejects a program whose localized root disappeared", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData();
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* activateProgramSnapshot(data);
          const root = yield* Effect.promise(() =>
            tCtx.db
              .query("curriculumRoutes")
              .withIndex("by_snapshotId_and_appLocale_and_path", (index) =>
                index
                  .eq("snapshotId", data.snapshotId)
                  .eq("appLocale", "en")
                  .eq("path", "curriculum/technical-program-1")
              )
              .unique()
          );
          if (!root) {
            throw new Error("Expected one English technical program root.");
          }
          yield* Effect.promise(() => tCtx.db.delete(root._id));
          expect(
            yield* readProgramCatalog("en").pipe(
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
  it.live("rejects a program catalog beyond its bounded read contract", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData();
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* activateProgramSnapshot(data);
          for (let index = 2; index < 101; index += 1) {
            yield* Effect.promise(() =>
              tCtx.db.insert("programCatalog", {
                displayOrder: index,
                index: index + 4,
                programKey: `overflow-program-${index}`,
                rowHash: "not-read",
                rowJson: "not-read",
                snapshotId: data.snapshotId,
              })
            );
          }
          expect(
            yield* readProgramCatalog("en").pipe(
              Effect.provide(programLayer),
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_LIMIT",
          });
        })
      );
    })
  );
});
