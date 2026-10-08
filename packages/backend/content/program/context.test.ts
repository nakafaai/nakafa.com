import { describe, expect, it } from "@effect/vitest";
import {
  CorpusSourcePathSchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  CurriculumNodeKeySchema,
  type CurriculumRoute,
  CurriculumRouteSchema,
} from "@nakafa/aksara-contracts/program/curriculum";
import { makeCurriculumSnapshotRow } from "@nakafa/aksara-contracts/program/snapshot/hash";
import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import { MaterialLessonProjectionSchema } from "@nakafa/aksara-contracts/projection/material";
import {
  type ContentSnapshotRow,
  canonicalizeContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot/data";
import refs from "@repo/backend/confect/_generated/refs";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import { stageProgramRow } from "@repo/backend/confect/contentRelease/snapshot/program";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { programLayer } from "@repo/backend/content/program/confect";
import { readProgramContext } from "@repo/backend/content/program/context";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import { insertMaterialProjection } from "@repo/backend/test/material/catalog";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
  type ProgramSnapshotData,
} from "@repo/backend/test/program/snapshot";
import { Effect } from "effect";

const PROGRAM_KEY = LearningProgramKeySchema.make("technical-program-1");
const SOURCE_MATERIAL = makeMaterialProjection("en", 1);
const MATERIAL_KEY = SOURCE_MATERIAL.materialKey;
const ROOT_PATH = PublicPathSchema.make("curriculum/technical-program-1");
const SUBJECT_PATH = PublicPathSchema.make(
  "curriculum/technical-program-1/test-subject"
);
const GROUP_PATH = PublicPathSchema.make(
  "curriculum/technical-program-1/test-subject/test-group"
);
const GROUP_KEY = CurriculumNodeKeySchema.make("test-group");
const MATERIAL_PARENT_PATH = SOURCE_MATERIAL.parentPath;
const MATERIAL_PUBLIC_PATH = SOURCE_MATERIAL.publicPath;
const SOURCE_PATH = CorpusSourcePathSchema.make(
  "packages/corpus/curriculum/technical-program-1"
);
const CONTEXT_INPUT = {
  contentKey: SOURCE_MATERIAL.contentKey,
  materialKey: MATERIAL_KEY,
  nodeKey: GROUP_KEY,
  parentPath: MATERIAL_PARENT_PATH,
  programKey: PROGRAM_KEY,
  publicPath: MATERIAL_PUBLIC_PATH,
};

/** Creates one curriculum subject that owns the material card list. */
function subjectRoute(): CurriculumRoute {
  return CurriculumRouteSchema.make({
    appLocale: AppLocaleSchema.make("en"),
    iconKey: "science",
    kind: "curriculum-context",
    level: "subject",
    nodeKey: "test-subject",
    order: 1,
    parentPath: ROOT_PATH,
    programKey: PROGRAM_KEY,
    publicPath: SUBJECT_PATH,
    sitemap: true,
    sourcePath: SOURCE_PATH,
    title: "Technical Subject",
  });
}

/** Creates the nearest curriculum group used as the `ctx` identity. */
function groupRoute(
  parentPath = SUBJECT_PATH,
  publicPath = GROUP_PATH,
  nodeKey = GROUP_KEY
): CurriculumRoute {
  return CurriculumRouteSchema.make({
    appLocale: AppLocaleSchema.make("en"),
    iconKey: "science",
    kind: "curriculum-context",
    level: "topic",
    materialCardDescription: "Technical card description.",
    materialCardTitle: "Technical Group",
    nodeKey,
    order: 1,
    parentPath,
    programKey: PROGRAM_KEY,
    publicPath,
    sitemap: false,
    sourcePath: SOURCE_PATH,
    title: "Technical Group",
  });
}

/** Creates one material mapping owned by the technical context group. */
function mappingRoute(
  index = 1,
  canonicalPath = MATERIAL_PARENT_PATH
): CurriculumRoute {
  const publicPath = PublicPathSchema.make(`${GROUP_PATH}/mapping-${index}`);
  return CurriculumRouteSchema.make({
    appLocale: AppLocaleSchema.make("en"),
    canonicalPath,
    iconKey: "science",
    kind: "curriculum-context",
    level: "lesson",
    materialContextNodeKey: GROUP_KEY,
    materialContextParentPath: SUBJECT_PATH,
    materialContextPublicPath: GROUP_PATH,
    materialKey: MATERIAL_KEY,
    nodeKey: `mapping-${index}`,
    order: index,
    parentPath: GROUP_PATH,
    programKey: PROGRAM_KEY,
    publicPath,
    sitemap: false,
    sourcePath: SOURCE_PATH,
    title: `Technical Mapping ${index}`,
  });
}

/** Stages additional immutable curriculum rows into one technical snapshot. */
const stageRoutes = Effect.fn("test.stageProgramContextRoutes")(function* (
  data: ProgramSnapshotData,
  routes: readonly CurriculumRoute[]
) {
  yield* Effect.forEach(
    routes,
    (route, offset) =>
      Effect.gen(function* () {
        const record = yield* makeCurriculumSnapshotRow(route);
        const source = {
          family: "program",
          record,
        } satisfies ContentSnapshotRow;
        const rowJson = canonicalizeContentSnapshotRow(source);
        yield* stageProgramRow(
          data.snapshotId,
          data.rowJson.length + offset,
          source.record,
          rowJson
        );
      }),
    {
      discard: true,
    }
  );
});
describe("contentRelease/program/context", () => {
  it.effect("returns unmanaged before program publication", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const result = yield* (yield* QueryRunner).runQuery(
            refs.public.contentRelease.program.context,
            {
              appLocale: "en",
              ...CONTEXT_INPUT,
            }
          );
          expect(result).toEqual({
            groupJson: null,
            managed: false,
            mappingJson: null,
            parentJson: null,
            resolvedCanonicalPath: null,
          });
        })
      );
    })
  );
  it.effect(
    "resolves one verified material context and its card-list parent",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            yield* activateProgramSnapshot(data);
            yield* stageRoutes(data, [
              subjectRoute(),
              groupRoute(),
              mappingRoute(),
            ]);
            expect(
              yield* (yield* QueryRunner).runQuery(
                refs.public.contentRelease.program.context,
                {
                  appLocale: "en",
                  ...CONTEXT_INPUT,
                }
              )
            ).toMatchObject({
              groupJson: expect.any(String),
              mappingJson: expect.any(String),
              parentJson: expect.any(String),
              resolvedCanonicalPath: MATERIAL_PARENT_PATH,
              managed: true,
            });
          })
        );
      })
  );
  it.effect(
    "resolves a moved exact lesson from the current signed projection",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const target = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* target.run(
          Effect.gen(function* () {
            const source = SOURCE_MATERIAL;
            const renamedParent = PublicPathSchema.make(
              "subjects/test/renamed-technical-topic"
            );
            const renamed = MaterialLessonProjectionSchema.make({
              ...source,
              parentPath: renamedParent,
              publicPath: PublicPathSchema.make(
                `${renamedParent}/renamed-technical-section`
              ),
            });
            yield* activateProgramSnapshot(data);
            yield* stageRoutes(data, [
              subjectRoute(),
              groupRoute(),
              mappingRoute(1, renamed.parentPath),
            ]);
            yield* insertMaterialProjection(renamed);
            expect(
              yield* readProgramContext("en", {
                ...CONTEXT_INPUT,
                parentPath: renamed.parentPath,
                publicPath: renamed.publicPath,
              }).pipe(Effect.provide(programLayer))
            ).toMatchObject({
              context: {
                mappingJson: expect.any(String),
                resolvedCanonicalPath: renamed.parentPath,
              },
              managed: true,
            });
          })
        );
      })
  );
  it.effect("ignores missing, root, and unmapped context hints", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData();
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          yield* activateProgramSnapshot(data);
          yield* stageRoutes(data, [subjectRoute(), groupRoute()]);
          for (const nodeKey of [
            "missing-group",
            `${PROGRAM_KEY}:root`,
            GROUP_KEY,
          ]) {
            expect(
              yield* readProgramContext("en", {
                ...CONTEXT_INPUT,
                nodeKey,
              }).pipe(Effect.provide(programLayer))
            ).toEqual({
              context: null,
              managed: true,
            });
          }
        })
      );
    })
  );
  it.effect(
    "ignores a context whose direct parent is not a card-list route",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            yield* activateProgramSnapshot(data);
            const directPath = PublicPathSchema.make(
              `${ROOT_PATH}/direct-group`
            );
            yield* stageRoutes(data, [
              groupRoute(
                ROOT_PATH,
                directPath,
                CurriculumNodeKeySchema.make("direct-group")
              ),
            ]);
            expect(
              yield* readProgramContext("en", {
                ...CONTEXT_INPUT,
                nodeKey: "direct-group",
              }).pipe(Effect.provide(programLayer))
            ).toEqual({
              context: null,
              managed: true,
            });
          })
        );
      })
  );
  it.effect("rejects a context group whose stored parent disappeared", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData();
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          yield* activateProgramSnapshot(data);
          const missingParent = PublicPathSchema.make(
            `${ROOT_PATH}/missing-parent`
          );
          const orphanPath = PublicPathSchema.make(
            `${missingParent}/orphan-group`
          );
          yield* stageRoutes(data, [
            groupRoute(
              missingParent,
              orphanPath,
              CurriculumNodeKeySchema.make("orphan-group")
            ),
          ]);
          expect(
            yield* readProgramContext("en", {
              ...CONTEXT_INPUT,
              nodeKey: "orphan-group",
            }).pipe(Effect.provide(programLayer), Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        })
      );
    })
  );
  it.effect(
    "rejects a context relationship beyond its bounded read contract",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            yield* activateProgramSnapshot(data);
            yield* stageRoutes(data, [
              subjectRoute(),
              groupRoute(),
              ...Array.from(
                {
                  length: 101,
                },
                (_, index) => mappingRoute(index + 1)
              ),
            ]);
            expect(
              yield* readProgramContext("en", CONTEXT_INPUT).pipe(
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
  it.effect(
    "rejects a sibling lesson when a mapping names one exact lesson",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const sibling = makeMaterialProjection("en", 2);
            yield* activateProgramSnapshot(data);
            yield* stageRoutes(data, [
              subjectRoute(),
              groupRoute(),
              mappingRoute(1, MATERIAL_PUBLIC_PATH),
            ]);
            yield* insertMaterialProjection(sibling);
            expect(
              yield* readProgramContext("en", CONTEXT_INPUT).pipe(
                Effect.provide(programLayer)
              )
            ).toMatchObject({
              context: {
                mappingJson: expect.any(String),
              },
              managed: true,
            });
            expect(
              yield* readProgramContext("en", {
                ...CONTEXT_INPUT,
                contentKey: sibling.contentKey,
                parentPath: sibling.parentPath,
                publicPath: sibling.publicPath,
              }).pipe(Effect.provide(programLayer))
            ).toEqual({
              context: null,
              managed: true,
            });
          })
        );
      })
  );
  it.effect("rejects ambiguous mappings for one exact material context", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData();
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          yield* activateProgramSnapshot(data);
          yield* stageRoutes(data, [
            subjectRoute(),
            groupRoute(),
            mappingRoute(1),
            mappingRoute(2),
          ]);
          expect(
            yield* readProgramContext("en", CONTEXT_INPUT).pipe(
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
