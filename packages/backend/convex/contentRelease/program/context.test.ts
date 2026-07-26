import {
  CorpusSourcePathSchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  CurriculumNodeKeySchema,
  type CurriculumRoute,
  CurriculumRouteSchema,
} from "@nakafa/aksara-contracts/program/curriculum";
import { makeCurriculumSnapshotRow } from "@nakafa/aksara-contracts/program/row-hash";
import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import { MaterialKeySchema } from "@nakafa/aksara-contracts/projection/material";
import {
  type ContentSnapshotRow,
  canonicalizeContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot-data";
import { readProgramContext } from "@repo/backend/convex/contentRelease/program/context";
import { stageProgramRow } from "@repo/backend/convex/contentRelease/snapshot/program";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
} from "@repo/backend/test/program-snapshot";
import type { TestConvex } from "convex-test";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const PROGRAM_KEY = LearningProgramKeySchema.make("technical-program-1");
const MATERIAL_KEY = MaterialKeySchema.make("lesson.test.topic");
const ROOT_PATH = PublicPathSchema.make("curriculum/technical-program-1");
const SUBJECT_PATH = PublicPathSchema.make(
  "curriculum/technical-program-1/test-subject"
);
const GROUP_PATH = PublicPathSchema.make(
  "curriculum/technical-program-1/test-subject/test-group"
);
const GROUP_KEY = CurriculumNodeKeySchema.make("test-group");
const SOURCE_PATH = CorpusSourcePathSchema.make(
  "packages/corpus/curriculum/technical-program-1"
);

/** Creates one curriculum subject that owns the material card list. */
function subjectRoute(): CurriculumRoute {
  return CurriculumRouteSchema.make({
    iconKey: "science",
    kind: "curriculum-context",
    level: "subject",
    locale: "en",
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
    iconKey: "science",
    kind: "curriculum-context",
    level: "topic",
    locale: "en",
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
function mappingRoute(index = 1): CurriculumRoute {
  const publicPath = PublicPathSchema.make(`${GROUP_PATH}/mapping-${index}`);
  return CurriculumRouteSchema.make({
    canonicalPath: PublicPathSchema.make("subjects/test/technical-topic"),
    iconKey: "science",
    kind: "curriculum-context",
    level: "lesson",
    locale: "en",
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
  snapshotId: string,
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
        stageProgramRow(ctx, snapshotId, offset + 6, row.source, row.rowJson)
      )
    );
  }
}

describe("contentRelease/program/context", () => {
  it("returns unmanaged before program publication", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readProgramContext(ctx, "en", PROGRAM_KEY, GROUP_KEY, MATERIAL_KEY)
        )
      )
    ).resolves.toEqual({
      groupJson: null,
      managed: false,
      parentJson: null,
    });
  });

  it("resolves one verified material context and its card-list parent", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    await activateProgramSnapshot(t, data);
    await stageRoutes(t, data.snapshotId, [
      subjectRoute(),
      groupRoute(),
      mappingRoute(),
    ]);

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readProgramContext(ctx, "en", PROGRAM_KEY, GROUP_KEY, MATERIAL_KEY)
        )
      )
    ).resolves.toMatchObject({
      groupJson: expect.any(String),
      managed: true,
      parentJson: expect.any(String),
    });
  });

  it("ignores missing, root, and unmapped context hints", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    await activateProgramSnapshot(t, data);
    await stageRoutes(t, data.snapshotId, [subjectRoute(), groupRoute()]);

    for (const nodeKey of ["missing-group", `${PROGRAM_KEY}:root`, GROUP_KEY]) {
      await expect(
        t.query((ctx) =>
          runConvexProgram(
            readProgramContext(ctx, "en", PROGRAM_KEY, nodeKey, MATERIAL_KEY)
          )
        )
      ).resolves.toEqual({
        groupJson: null,
        managed: true,
        parentJson: null,
      });
    }
  });

  it("ignores a context whose direct parent is not a card-list route", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    await activateProgramSnapshot(t, data);
    const directPath = PublicPathSchema.make(`${ROOT_PATH}/direct-group`);
    await stageRoutes(t, data.snapshotId, [
      groupRoute(
        ROOT_PATH,
        directPath,
        CurriculumNodeKeySchema.make("direct-group")
      ),
    ]);

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readProgramContext(
            ctx,
            "en",
            PROGRAM_KEY,
            "direct-group",
            MATERIAL_KEY
          )
        )
      )
    ).resolves.toEqual({
      groupJson: null,
      managed: true,
      parentJson: null,
    });
  });

  it("rejects a context group whose stored parent disappeared", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    await activateProgramSnapshot(t, data);
    const missingParent = PublicPathSchema.make(`${ROOT_PATH}/missing-parent`);
    const orphanPath = PublicPathSchema.make(`${missingParent}/orphan-group`);
    await stageRoutes(t, data.snapshotId, [
      groupRoute(
        missingParent,
        orphanPath,
        CurriculumNodeKeySchema.make("orphan-group")
      ),
    ]);

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readProgramContext(
            ctx,
            "en",
            PROGRAM_KEY,
            "orphan-group",
            MATERIAL_KEY
          )
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
    await stageRoutes(t, data.snapshotId, [
      subjectRoute(),
      groupRoute(),
      ...Array.from({ length: 101 }, (_, index) => mappingRoute(index + 1)),
    ]);

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readProgramContext(ctx, "en", PROGRAM_KEY, GROUP_KEY, MATERIAL_KEY)
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });
});
