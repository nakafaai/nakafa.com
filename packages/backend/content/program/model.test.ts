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
import { makeCurriculumSnapshotRow } from "@nakafa/aksara-contracts/program/snapshot/row-hash";
import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import { canonicalizeContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import { api } from "@repo/backend/convex/_generated/api";
import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import {
  PROGRAM_ANCESTOR_LIMIT,
  PROGRAM_RELATED_LIMIT,
} from "@repo/backend/convex/contentRelease/program/limits";
import { stageProgramRow } from "@repo/backend/convex/contentRelease/snapshot/program";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
  makeTechnicalProgram,
} from "@repo/backend/test/program/snapshot";
import { convexTest, type TestConvex } from "convex-test";
import { Effect } from "effect";

const root = "curriculum/technical-program-1";
const appLocale = ActiveAppLocaleSchema.make("en");
const technicalProgram = makeTechnicalProgram(1);
const englishTranslation = technicalProgram.translations.find(
  (translation) => translation.appLocale === appLocale
);
assert(englishTranslation);
const englishProgram = {
  ...technicalProgram,
  translations: [englishTranslation] as const,
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
  t: TestConvex<typeof schema>,
  snapshotId: string,
  routes: readonly ReturnType<typeof nestedRoute>[]
) {
  const records = yield* Effect.forEach(routes, makeCurriculumSnapshotRow);
  yield* Effect.promise(() =>
    t.mutation((ctx) =>
      runConvexProgram(
        Effect.forEach(
          records,
          (record, index) => {
            const source = { family: "program", record } as const;
            return stageProgramRow(
              ctx,
              snapshotId,
              index + 100,
              source,
              canonicalizeContentSnapshotRow(source)
            );
          },
          { discard: true }
        )
      )
    )
  );
});

describe("program route relationship integrity", () => {
  it.effect(
    "rejects program metadata that no longer matches its immutable signed row",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateProgramSnapshot(t, data));
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const rows = await ctx.db.query("programCatalog").collect();
            const program = rows.find(
              (row) => row.programKey === "technical-program-1"
            );
            assert(program);
            await ctx.db.patch("programCatalog", program._id, {
              displayOrder: program.displayOrder + 1,
            });
          })
        );
        yield* Effect.promise(() =>
          expect(
            t.query(api.contentRelease.program.route, {
              appLocale: "en",
              publicPath: root,
            })
          ).rejects.toMatchObject({
            data: { code: "CONTENT_RELEASE_INTEGRITY" },
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
        const t = convexTest(schema, convexModules);
        const material = makeMaterialProjection("en", 1);
        const context = CurriculumRouteSchema.make({
          ...nestedRoute(`${root}/missing/context`, "context"),
          canonicalPath: material.parentPath,
          materialContextNodeKey: CurriculumNodeKeySchema.make("missing"),
          materialContextParentPath: PublicPathSchema.make(root),
          materialContextPublicPath: PublicPathSchema.make(`${root}/missing`),
          materialKey: material.materialKey,
          sitemap: false,
        });
        yield* Effect.promise(() => activateProgramSnapshot(t, data));
        yield* stageRoutes(t, data.snapshotId, [context]);
        yield* Effect.promise(() =>
          expect(
            t.query(api.contentRelease.program.route, {
              appLocale: "en",
              publicPath: root,
            })
          ).rejects.toMatchObject({
            data: { code: "CONTENT_RELEASE_INTEGRITY" },
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
      const t = convexTest(schema, convexModules);
      const subject = nestedRoute(`${root}/subject`, "subject");
      const child = nestedRoute(`${subject.publicPath}/child`, "child");
      yield* Effect.promise(() => activateProgramSnapshot(t, data));
      yield* stageRoutes(t, data.snapshotId, [subject, child]);
      const result = yield* Effect.promise(() =>
        t.query(api.contentRelease.program.route, {
          appLocale: "en",
          publicPath: child.publicPath,
        })
      );
      const ancestors = yield* Effect.forEach(
        result.ancestorJson,
        decodeSnapshotRowJson
      );
      expect(ancestors).toMatchObject([
        {
          family: "program",
          record: { kind: "curriculum", row: { publicPath: root } },
        },
        {
          family: "program",
          record: {
            kind: "curriculum",
            row: { publicPath: subject.publicPath },
          },
        },
      ]);
      expect(result.alternateJson).toHaveLength(1);
    })
  );

  it.effect("rejects a nested route whose immediate parent disappeared", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData(
        [englishProgram],
        [appLocale]
      );
      const t = convexTest(schema, convexModules);
      const child = nestedRoute(`${root}/missing/child`, "child");
      yield* Effect.promise(() => activateProgramSnapshot(t, data));
      yield* stageRoutes(t, data.snapshotId, [child]);
      yield* Effect.promise(() =>
        expect(
          t.query(api.contentRelease.program.route, {
            appLocale: "en",
            publicPath: child.publicPath,
          })
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } })
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
        const t = convexTest(schema, convexModules);
        const paths = Array.from(
          { length: PROGRAM_ANCESTOR_LIMIT + 1 },
          (_, index) =>
            `${root}/${Array.from({ length: index + 1 }, (_, segment) => `level-${segment}`).join("/")}`
        );
        const routes = paths.map((path, index) =>
          nestedRoute(path, `level-${index}`)
        );
        const requested = routes.at(-1);
        assert(requested);
        yield* Effect.promise(() => activateProgramSnapshot(t, data));
        yield* stageRoutes(t, data.snapshotId, routes);
        yield* Effect.promise(() =>
          expect(
            t.query(api.contentRelease.program.route, {
              appLocale: "en",
              publicPath: requested.publicPath,
            })
          ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_LIMIT" } })
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
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateProgramSnapshot(t, data));
        yield* stageRoutes(
          t,
          data.snapshotId,
          Array.from({ length: PROGRAM_RELATED_LIMIT + 1 }, (_, index) =>
            nestedRoute(`${root}/child-${index}`, `child-${index}`)
          )
        );
        yield* Effect.promise(() =>
          expect(
            t.query(api.contentRelease.program.route, {
              appLocale: "en",
              publicPath: root,
            })
          ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_LIMIT" } })
        );
      })
  );

  it.effect(
    "rejects a route whose required translated counterpart disappeared",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateProgramSnapshot(t, data));
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const rows = await ctx.db.query("curriculumRoutes").collect();
            const german = rows.find(
              (row) =>
                row.appLocale === "de" &&
                row.programKey === "technical-program-1"
            );
            assert(german);
            await ctx.db.delete("curriculumRoutes", german._id);
          })
        );
        yield* Effect.promise(() =>
          expect(
            t.query(api.contentRelease.program.route, {
              appLocale: "en",
              publicPath: root,
            })
          ).rejects.toMatchObject({
            data: { code: "CONTENT_RELEASE_INTEGRITY" },
          })
        );
      })
  );
});
