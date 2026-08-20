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
import { makeCurriculumSnapshotRow } from "@nakafa/aksara-contracts/program/snapshot/row-hash";
import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import { MaterialLessonProjectionSchema } from "@nakafa/aksara-contracts/projection/material";
import {
  type ContentSnapshotRow,
  canonicalizeContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot/data";
import { readProgramContext } from "@repo/backend/convex/contentRelease/program/context";
import { stageProgramRow } from "@repo/backend/convex/contentRelease/snapshot/program";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import { insertMaterialProjection } from "@repo/backend/test/material-catalog";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
  type ProgramSnapshotData,
} from "@repo/backend/test/program-snapshot";
import type { TestConvex } from "convex-test";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

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
async function stageRoutes(
  target: TestConvex<typeof schema>,
  data: ProgramSnapshotData,
  routes: readonly CurriculumRoute[]
) {
  const rows = await Effect.runPromise(
    Effect.forEach(routes, (route) =>
      Effect.gen(function* () {
        const record = yield* makeCurriculumSnapshotRow(route);
        const source = {
          family: "program",
          record,
        } satisfies ContentSnapshotRow;
        return {
          rowJson: canonicalizeContentSnapshotRow(source),
          source,
        };
      })
    )
  );
  for (const [offset, row] of rows.entries()) {
    await target.mutation((ctx) =>
      runConvexProgram(
        stageProgramRow(
          ctx,
          data.snapshotId,
          data.rowJson.length + offset,
          row.source,
          row.rowJson
        )
      )
    );
  }
}

describe("contentRelease/program/context", () => {
  it("returns unmanaged before program publication", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) =>
        runConvexProgram(readProgramContext(ctx, "en", CONTEXT_INPUT))
      )
    ).resolves.toEqual({
      context: null,
      managed: false,
    });
  });

  it("resolves one verified material context and its card-list parent", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    await activateProgramSnapshot(t, data);
    await stageRoutes(t, data, [subjectRoute(), groupRoute(), mappingRoute()]);

    await expect(
      t.query((ctx) =>
        runConvexProgram(readProgramContext(ctx, "en", CONTEXT_INPUT))
      )
    ).resolves.toMatchObject({
      context: {
        groupJson: expect.any(String),
        mappingJson: expect.any(String),
        parentJson: expect.any(String),
      },
      managed: true,
    });
  });

  it("resolves a moved exact lesson from the current signed projection", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const target = convexTest(schema, convexModules);
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
    await activateProgramSnapshot(target, data);
    await stageRoutes(target, data, [
      subjectRoute(),
      groupRoute(),
      mappingRoute(1, renamed.parentPath),
    ]);
    await target.mutation(async (ctx) => {
      await insertMaterialProjection(ctx, renamed);
    });

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readProgramContext(ctx, "en", {
            ...CONTEXT_INPUT,
            parentPath: renamed.parentPath,
            publicPath: renamed.publicPath,
          })
        )
      )
    ).resolves.toMatchObject({
      context: {
        mappingJson: expect.any(String),
        resolvedCanonicalPath: renamed.parentPath,
      },
      managed: true,
    });
  });

  it("ignores missing, root, and unmapped context hints", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    await activateProgramSnapshot(t, data);
    await stageRoutes(t, data, [subjectRoute(), groupRoute()]);

    for (const nodeKey of ["missing-group", `${PROGRAM_KEY}:root`, GROUP_KEY]) {
      await expect(
        t.query((ctx) =>
          runConvexProgram(
            readProgramContext(ctx, "en", {
              ...CONTEXT_INPUT,
              nodeKey,
            })
          )
        )
      ).resolves.toEqual({
        context: null,
        managed: true,
      });
    }
  });

  it("ignores a context whose direct parent is not a card-list route", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    await activateProgramSnapshot(t, data);
    const directPath = PublicPathSchema.make(`${ROOT_PATH}/direct-group`);
    await stageRoutes(t, data, [
      groupRoute(
        ROOT_PATH,
        directPath,
        CurriculumNodeKeySchema.make("direct-group")
      ),
    ]);

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readProgramContext(ctx, "en", {
            ...CONTEXT_INPUT,
            nodeKey: "direct-group",
          })
        )
      )
    ).resolves.toEqual({
      context: null,
      managed: true,
    });
  });

  it("rejects a context group whose stored parent disappeared", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    await activateProgramSnapshot(t, data);
    const missingParent = PublicPathSchema.make(`${ROOT_PATH}/missing-parent`);
    const orphanPath = PublicPathSchema.make(`${missingParent}/orphan-group`);
    await stageRoutes(t, data, [
      groupRoute(
        missingParent,
        orphanPath,
        CurriculumNodeKeySchema.make("orphan-group")
      ),
    ]);

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readProgramContext(ctx, "en", {
            ...CONTEXT_INPUT,
            nodeKey: "orphan-group",
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects a context relationship beyond its bounded read contract", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    await activateProgramSnapshot(t, data);
    await stageRoutes(t, data, [
      subjectRoute(),
      groupRoute(),
      ...Array.from({ length: 101 }, (_, index) => mappingRoute(index + 1)),
    ]);

    await expect(
      t.query((ctx) =>
        runConvexProgram(readProgramContext(ctx, "en", CONTEXT_INPUT))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });

  it("rejects a sibling lesson when a mapping names one exact lesson", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    const sibling = makeMaterialProjection("en", 2);
    await activateProgramSnapshot(t, data);
    await stageRoutes(t, data, [
      subjectRoute(),
      groupRoute(),
      mappingRoute(1, MATERIAL_PUBLIC_PATH),
    ]);
    await t.mutation((ctx) => insertMaterialProjection(ctx, sibling));

    await expect(
      t.query((ctx) =>
        runConvexProgram(readProgramContext(ctx, "en", CONTEXT_INPUT))
      )
    ).resolves.toMatchObject({
      context: { mappingJson: expect.any(String) },
      managed: true,
    });
    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readProgramContext(ctx, "en", {
            ...CONTEXT_INPUT,
            contentKey: sibling.contentKey,
            parentPath: sibling.parentPath,
            publicPath: sibling.publicPath,
          })
        )
      )
    ).resolves.toEqual({ context: null, managed: true });
  });

  it("rejects ambiguous mappings for one exact material context", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    await activateProgramSnapshot(t, data);
    await stageRoutes(t, data, [
      subjectRoute(),
      groupRoute(),
      mappingRoute(1),
      mappingRoute(2),
    ]);

    await expect(
      t.query((ctx) =>
        runConvexProgram(readProgramContext(ctx, "en", CONTEXT_INPUT))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
