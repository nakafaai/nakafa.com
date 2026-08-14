import {
  CorpusSourcePathSchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import { ActiveAppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  CurriculumNodeKeySchema,
  type CurriculumRoute,
  CurriculumRouteSchema,
} from "@nakafa/aksara-contracts/program/curriculum";
import { makeCurriculumSnapshotRow } from "@nakafa/aksara-contracts/program/snapshot/row-hash";
import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import {
  type MaterialLessonProjection,
  MaterialLessonProjectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
import {
  type ContentSnapshotRow,
  canonicalizeContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot/data";
import { stageProgramRow } from "@repo/backend/convex/contentRelease/snapshot/program";
import type { LearningContextInput } from "@repo/backend/convex/contents/context";
import { resolveLearningContext } from "@repo/backend/convex/contents/views/context";
import { loadContentTarget } from "@repo/backend/convex/contents/views/target";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { FUNCTION_MATERIAL } from "@repo/backend/test/content-material";
import {
  activateMaterialCatalog,
  insertMaterialProjection,
} from "@repo/backend/test/material-catalog";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
} from "@repo/backend/test/program-snapshot";
import type { TestConvex } from "convex-test";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const PROGRAM_KEY = LearningProgramKeySchema.make("technical-program-1");
const GROUP_KEY = CurriculumNodeKeySchema.make("test-group");
const ROOT_PATH = PublicPathSchema.make("curriculum/technical-program-1");
const SUBJECT_PATH = PublicPathSchema.make(
  "curriculum/technical-program-1/test-subject"
);
const GROUP_PATH = PublicPathSchema.make(
  "curriculum/technical-program-1/test-subject/test-group"
);
const SOURCE_PATH = CorpusSourcePathSchema.make(
  "packages/corpus/curriculum/technical-program-1"
);
const PLACEMENT = {
  mode: "placement",
  nodeKey: GROUP_KEY,
  programKey: PROGRAM_KEY,
} satisfies LearningContextInput;
const RENAMED_MATERIAL = MaterialLessonProjectionSchema.make({
  ...FUNCTION_MATERIAL,
  publicPath: PublicPathSchema.make(
    `${FUNCTION_MATERIAL.parentPath}/function-concept-renamed`
  ),
});

/** Creates the card-list parent for the placement group. */
function subjectRoute(): CurriculumRoute {
  return CurriculumRouteSchema.make({
    iconKey: "science",
    kind: "curriculum-context",
    level: "subject",
    appLocale: ActiveAppLocaleSchema.make("en"),
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

/** Creates the placement group named by the public context hint. */
function groupRoute(): CurriculumRoute {
  return CurriculumRouteSchema.make({
    iconKey: "science",
    kind: "curriculum-context",
    level: "topic",
    appLocale: ActiveAppLocaleSchema.make("en"),
    materialCardDescription: "Technical card description.",
    materialCardTitle: "Technical Group",
    nodeKey: GROUP_KEY,
    order: 1,
    parentPath: SUBJECT_PATH,
    programKey: PROGRAM_KEY,
    publicPath: GROUP_PATH,
    sitemap: false,
    sourcePath: SOURCE_PATH,
    title: "Technical Group",
  });
}

/** Creates one immutable material mapping for the placement group. */
function mappingRoute(
  canonicalPath: typeof FUNCTION_MATERIAL.publicPath
): CurriculumRoute {
  return CurriculumRouteSchema.make({
    canonicalPath,
    iconKey: "science",
    kind: "curriculum-context",
    level: "lesson",
    appLocale: ActiveAppLocaleSchema.make("en"),
    materialContextNodeKey: GROUP_KEY,
    materialContextParentPath: SUBJECT_PATH,
    materialContextPublicPath: GROUP_PATH,
    materialKey: FUNCTION_MATERIAL.materialKey,
    nodeKey: "test-material-mapping",
    order: 1,
    parentPath: GROUP_PATH,
    programKey: PROGRAM_KEY,
    publicPath: PublicPathSchema.make(`${GROUP_PATH}/test-material-mapping`),
    sitemap: false,
    sourcePath: SOURCE_PATH,
    title: "Technical Material Mapping",
  });
}

/** Adds current signed placement rows to the active program snapshot. */
async function stagePlacement(
  target: TestConvex<typeof schema>,
  snapshotId: string,
  canonicalPath: typeof FUNCTION_MATERIAL.publicPath
) {
  const routes = [subjectRoute(), groupRoute(), mappingRoute(canonicalPath)];
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
        stageProgramRow(ctx, snapshotId, offset + 100, row.source, row.rowJson)
      )
    );
  }
}

/** Resolves context through the current signed material target. */
function readContext(
  target: TestConvex<typeof schema>,
  projection: MaterialLessonProjection,
  context?: LearningContextInput
) {
  return target.query((ctx) =>
    runConvexProgram(
      Effect.gen(function* () {
        const material = yield* loadContentTarget(ctx, {
          contentId: projection.graph.assetId,
          locale: "en",
          publicPath: projection.publicPath,
          section: "material",
        });
        if (!material) {
          return yield* Effect.die(
            new Error("Expected one current signed material target.")
          );
        }
        return yield* resolveLearningContext(ctx, material, context);
      })
    )
  );
}

/** Activates one current signed program and material placement fixture. */
async function activatePlacement(
  target: TestConvex<typeof schema>,
  canonicalPath: typeof FUNCTION_MATERIAL.publicPath,
  projection: MaterialLessonProjection = FUNCTION_MATERIAL
) {
  const data = await Effect.runPromise(makeProgramSnapshotData());
  await activateProgramSnapshot(target, data);
  await stagePlacement(target, data.snapshotId, canonicalPath);
  await target.mutation((ctx) => insertMaterialProjection(ctx, projection));
}

describe("contents/views/context", () => {
  it("keeps a direct visit canonical", async () => {
    const target = convexTest(schema, convexModules);
    await activateMaterialCatalog(target, [FUNCTION_MATERIAL]);

    await expect(readContext(target, FUNCTION_MATERIAL)).resolves.toEqual({
      contextKey: "canonical",
      contextMode: "canonical",
    });
  });

  it("rejects placement when signed curriculum ownership is unavailable", async () => {
    const target = convexTest(schema, convexModules);
    await activateMaterialCatalog(target, [FUNCTION_MATERIAL]);

    await expect(
      readContext(target, FUNCTION_MATERIAL, PLACEMENT)
    ).rejects.toMatchObject({
      data: { code: "CONTENT_VIEW_IO_FAILED" },
    });
  });

  it("resolves an exact current signed curriculum placement", async () => {
    const target = convexTest(schema, convexModules);
    await activatePlacement(target, FUNCTION_MATERIAL.publicPath);

    await expect(
      readContext(target, FUNCTION_MATERIAL, PLACEMENT)
    ).resolves.toMatchObject({
      contextKey: `placement:${PROGRAM_KEY}:${GROUP_KEY}`,
      contextMaterialKey: FUNCTION_MATERIAL.materialKey,
      contextMode: "placement",
      contextNodeKey: GROUP_KEY,
      contextParentPath: SUBJECT_PATH,
      contextProgramKey: PROGRAM_KEY,
      contextPublicPath: GROUP_PATH,
    });
  });

  it("keeps a stable parent placement after a signed lesson rename", async () => {
    const target = convexTest(schema, convexModules);
    await activatePlacement(
      target,
      FUNCTION_MATERIAL.parentPath,
      RENAMED_MATERIAL
    );

    await expect(
      readContext(target, RENAMED_MATERIAL, PLACEMENT)
    ).resolves.toMatchObject({
      contextKey: `placement:${PROGRAM_KEY}:${GROUP_KEY}`,
      contextMaterialKey: FUNCTION_MATERIAL.materialKey,
      contextMode: "placement",
    });
  });

  it("makes an unverified signed placement canonical", async () => {
    const target = convexTest(schema, convexModules);
    await activatePlacement(target, FUNCTION_MATERIAL.publicPath);

    await expect(
      readContext(target, FUNCTION_MATERIAL, {
        mode: "placement",
        nodeKey: "missing-group",
        programKey: PROGRAM_KEY,
      })
    ).resolves.toEqual({
      contextKey: "canonical",
      contextMode: "canonical",
    });
  });
});
