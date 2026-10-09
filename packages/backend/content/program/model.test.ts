import { assert, describe, expect, it } from "@effect/vitest";
import {
  CorpusSourcePathSchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import { ActiveAppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  CurriculumNodeKeySchema,
  CurriculumRouteSchema,
} from "@nakafa/aksara-contracts/program/curriculum";
import { makeCurriculumSnapshotRow } from "@nakafa/aksara-contracts/program/snapshot/hash";
import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import { canonicalizeContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationCtx,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { decodeSnapshotRowJson } from "@repo/backend/confect/contentRelease/parse";
import {
  PROGRAM_ANCESTOR_LIMIT,
  PROGRAM_RELATED_LIMIT,
} from "@repo/backend/confect/contentRelease/program/limits";
import { stageProgramRow } from "@repo/backend/confect/contentRelease/snapshot/program";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
  makeTechnicalProgram,
} from "@repo/backend/test/program/snapshot";
import { Array as Arr, Effect, Option } from "effect";

const root = "curriculum/technical-program-1";
const appLocale = ActiveAppLocaleSchema.make("en");
const technicalProgram = makeTechnicalProgram(1);
const englishTranslation = Arr.findFirst(
  technicalProgram.translations,
  (translation) => translation.appLocale === appLocale
);
assert(Option.isSome(englishTranslation));
const englishProgram = {
  ...technicalProgram,
  translations: [englishTranslation.value] as const,
};

/** Builds a signed nested route that keeps the real direct-parent contract. */
function nestedRoute(path: string, nodeKey: string) {
  return CurriculumRouteSchema.make({
    appLocale,
    iconKey: "school",
    kind: "curriculum-context",
    level: "subject",
    nodeKey,
    order: 1,
    parentPath: PublicPathSchema.make(path.slice(0, path.lastIndexOf("/"))),
    programKey: LearningProgramKeySchema.make("technical-program-1"),
    publicPath: PublicPathSchema.make(path),
    sitemap: true,
    sourcePath: CorpusSourcePathSchema.make(
      "packages/corpus/curriculum/technical-program-1"
    ),
    title: nodeKey,
  });
}

/** Writes authenticated rows through the native immutable snapshot writer. */
const stageRoutes = Effect.fn("program.model.test.stageRoutes")(function* (
  snapshotId: string,
  routes: readonly ReturnType<typeof nestedRoute>[]
) {
  const records = yield* Effect.forEach(routes, makeCurriculumSnapshotRow);
  yield* Effect.forEach(
    records,
    (record, index) => {
      const source = {
        family: "program",
        record,
      } as const;
      return stageProgramRow(
        snapshotId,
        index + 100,
        source.record,
        canonicalizeContentSnapshotRow(source)
      );
    },
    {
      discard: true,
    }
  );
});
describe("program route relationship integrity", () => {
  it.effect(
    "rejects program metadata that no longer matches its immutable signed row",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            yield* activateProgramSnapshot(data);
            const rows = yield* Effect.promise(() =>
              tCtx.db.query("programCatalog").collect()
            );
            const program = Arr.findFirst(
              rows,
              (row) => row.programKey === "technical-program-1"
            );
            assert(Option.isSome(program));
            yield* Effect.promise(() =>
              tCtx.db.patch("programCatalog", program.value._id, {
                displayOrder: program.value.displayOrder + 1,
              })
            );
            expect(
              yield* (yield* QueryRunner)
                .runQuery(refs.public.contentRelease.program.route, {
                  appLocale: "en",
                  publicPath: root,
                })
                .pipe(Effect.flip)
            ).toMatchObject({
              code: "CONTENT_RELEASE_INTEGRITY",
            });
          })
        );
      })
  );
  it.effect(
    "rejects a material context whose authored display group disappeared",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData(
          [englishProgram],
          [appLocale]
        );
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const material = makeMaterialProjection("en", 1);
            const context = CurriculumRouteSchema.make({
              ...nestedRoute(`${root}/missing/context`, "context"),
              canonicalPath: material.parentPath,
              materialContextNodeKey: CurriculumNodeKeySchema.make("missing"),
              materialContextParentPath: PublicPathSchema.make(root),
              materialContextPublicPath: PublicPathSchema.make(
                `${root}/missing`
              ),
              materialKey: material.materialKey,
              sitemap: false,
            });
            yield* activateProgramSnapshot(data);
            yield* stageRoutes(data.snapshotId, [context]);
            expect(
              yield* (yield* QueryRunner)
                .runQuery(refs.public.contentRelease.program.route, {
                  appLocale: "en",
                  publicPath: root,
                })
                .pipe(Effect.flip)
            ).toMatchObject({
              code: "CONTENT_RELEASE_INTEGRITY",
            });
          })
        );
      })
  );
  it.effect("returns the complete ordered parent chain of a nested route", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData(
        [englishProgram],
        [appLocale]
      );
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const subject = nestedRoute(`${root}/subject`, "subject");
          const child = nestedRoute(`${subject.publicPath}/child`, "child");
          yield* activateProgramSnapshot(data);
          yield* stageRoutes(data.snapshotId, [subject, child]);
          const result = yield* (yield* QueryRunner).runQuery(
            refs.public.contentRelease.program.route,
            {
              appLocale: "en",
              publicPath: child.publicPath,
            }
          );
          const ancestors = yield* Effect.forEach(
            result.ancestorJson,
            decodeSnapshotRowJson
          );
          expect(ancestors).toMatchObject([
            {
              family: "program",
              record: {
                kind: "curriculum",
                row: {
                  publicPath: root,
                },
              },
            },
            {
              family: "program",
              record: {
                kind: "curriculum",
                row: {
                  publicPath: subject.publicPath,
                },
              },
            },
          ]);
          expect(result.alternateJson).toHaveLength(1);
        })
      );
    })
  );
  it.effect("rejects a nested route whose immediate parent disappeared", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData(
        [englishProgram],
        [appLocale]
      );
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const child = nestedRoute(`${root}/missing/child`, "child");
          yield* activateProgramSnapshot(data);
          yield* stageRoutes(data.snapshotId, [child]);
          expect(
            yield* (yield* QueryRunner)
              .runQuery(refs.public.contentRelease.program.route, {
                appLocale: "en",
                publicPath: child.publicPath,
              })
              .pipe(Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        })
      );
    })
  );
  it.effect(
    "rejects a parent chain beyond the supported navigation depth",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData(
          [englishProgram],
          [appLocale]
        );
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const paths = Array.from(
              {
                length: PROGRAM_ANCESTOR_LIMIT + 1,
              },
              (_, index) =>
                `${root}/${Arr.join(
                  Array.from(
                    {
                      length: index + 1,
                    },
                    (_, segment) => `level-${segment}`
                  ),
                  "/"
                )}`
            );
            const routes = Arr.map(paths, (path, index) =>
              nestedRoute(path, `level-${index}`)
            );
            const requested = Option.getOrThrow(Arr.last(routes));
            assert(requested);
            yield* activateProgramSnapshot(data);
            yield* stageRoutes(data.snapshotId, routes);
            expect(
              yield* (yield* QueryRunner)
                .runQuery(refs.public.contentRelease.program.route, {
                  appLocale: "en",
                  publicPath: requested.publicPath,
                })
                .pipe(Effect.flip)
            ).toMatchObject({
              code: "CONTENT_RELEASE_LIMIT",
            });
          })
        );
      })
  );
  it.effect(
    "rejects a child relation larger than its bounded read contract",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData(
          [englishProgram],
          [appLocale]
        );
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            yield* activateProgramSnapshot(data);
            yield* stageRoutes(
              data.snapshotId,
              Array.from(
                {
                  length: PROGRAM_RELATED_LIMIT + 1,
                },
                (_, index) =>
                  nestedRoute(`${root}/child-${index}`, `child-${index}`)
              )
            );
            expect(
              yield* (yield* QueryRunner)
                .runQuery(refs.public.contentRelease.program.route, {
                  appLocale: "en",
                  publicPath: root,
                })
                .pipe(Effect.flip)
            ).toMatchObject({
              code: "CONTENT_RELEASE_LIMIT",
            });
          })
        );
      })
  );
  it.effect(
    "rejects a route whose required translated counterpart disappeared",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            yield* activateProgramSnapshot(data);
            const rows = yield* Effect.promise(() =>
              tCtx.db.query("curriculumRoutes").collect()
            );
            const german = Arr.findFirst(
              rows,
              (row) =>
                row.appLocale === "de" &&
                row.programKey === "technical-program-1"
            );
            assert(Option.isSome(german));
            yield* Effect.promise(() =>
              tCtx.db.delete("curriculumRoutes", german.value._id)
            );
            expect(
              yield* (yield* QueryRunner)
                .runQuery(refs.public.contentRelease.program.route, {
                  appLocale: "en",
                  publicPath: root,
                })
                .pipe(Effect.flip)
            ).toMatchObject({
              code: "CONTENT_RELEASE_INTEGRITY",
            });
          })
        );
      })
  );
});
