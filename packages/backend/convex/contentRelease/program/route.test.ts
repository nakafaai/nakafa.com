import { CurriculumRouteSchema } from "@nakafa/aksara-contracts/program/curriculum";
import { makeCurriculumSnapshotRow } from "@nakafa/aksara-contracts/program/row-hash";
import { canonicalizeContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot-data";
import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import { readProgramRoute } from "@repo/backend/convex/contentRelease/program/route";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content-release";
import { insertMaterialProjection } from "@repo/backend/test/material-catalog";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
} from "@repo/backend/test/program-snapshot";
import { convexTest, type TestConvex } from "convex-test";
import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";

const PROGRAM_ROOT = "curriculum/technical-program-1";

/** Creates one authored material group under the technical root. */
function materialGroup(groupIndex: number, order: number) {
  return Schema.decodeUnknownSync(CurriculumRouteSchema)({
    iconKey: "school",
    kind: "curriculum-context",
    level: "topic",
    locale: "en",
    nodeKey: `group-${groupIndex}`,
    order,
    parentPath: PROGRAM_ROOT,
    programKey: "technical-program-1",
    publicPath: `${PROGRAM_ROOT}/group-${groupIndex}`,
    sitemap: false,
    sourcePath: "packages/corpus/curriculum/technical-program-1",
    title: `Technical Group ${groupIndex}`,
  });
}

/** Creates one material-owning route displayed under an authored group. */
function materialContext(
  materialIndex: number,
  group?: ReturnType<typeof materialGroup>
) {
  const groupNodeKey = group?.nodeKey ?? `context-${materialIndex}`;
  const groupPath = group?.publicPath ?? PROGRAM_ROOT;
  return Schema.decodeUnknownSync(CurriculumRouteSchema)({
    canonicalPath: `subjects/test/technical-topic-${materialIndex}`,
    iconKey: "school",
    kind: "curriculum-context",
    level: "topic",
    locale: "en",
    materialContextNodeKey: groupNodeKey,
    materialContextParentPath: PROGRAM_ROOT,
    materialContextPublicPath: groupPath,
    materialKey: `lesson.test.topic-${materialIndex}`,
    nodeKey: `context-${materialIndex}`,
    order: materialIndex,
    parentPath: groupPath,
    programKey: "technical-program-1",
    publicPath: `${groupPath}/context-${materialIndex}`,
    sitemap: false,
    sourcePath: "packages/corpus/curriculum/technical-program-1",
    title: `Technical Context ${materialIndex}`,
  });
}

/** Adds exact authored curriculum routes to one active test snapshot. */
async function insertCurriculumRoutes(
  target: TestConvex<typeof schema>,
  snapshotId: string,
  routes: readonly ReturnType<typeof materialContext>[]
) {
  const records = await Effect.runPromise(
    Effect.forEach(routes, makeCurriculumSnapshotRow)
  );
  await target.mutation(async (ctx) => {
    for (const [offset, record] of records.entries()) {
      const row = record.row;
      await ctx.db.insert("curriculumRoutes", {
        index: 10 + offset,
        level: row.level,
        locale: row.locale,
        contextPath: row.materialContextParentPath,
        materialKey: row.materialKey,
        nodeKey: row.nodeKey,
        order: row.order,
        parentPath: row.parentPath,
        programKey: row.programKey,
        path: row.publicPath,
        rowHash: record.rowHash,
        rowJson: canonicalizeContentSnapshotRow({
          family: "program",
          record,
        }),
        snapshotId,
        sourcePath: row.sourcePath,
      });
    }
  });
}

/** Inserts material projections in bounded test transactions. */
async function insertMaterialGroups(
  target: TestConvex<typeof schema>,
  groups: readonly {
    readonly materialIndex: number;
    readonly rowCount: number;
  }[]
) {
  const projections = groups.flatMap(({ materialIndex, rowCount }) =>
    Array.from({ length: rowCount }, (_, index) =>
      makeMaterialProjection("en", index + 1, materialIndex)
    )
  );
  for (let first = 0; first < projections.length; first += 32) {
    await target.mutation(async (ctx) => {
      for (const projection of projections.slice(first, first + 32)) {
        await insertMaterialProjection(ctx, projection);
      }
    });
  }
}

describe("contentRelease/program/route", () => {
  it("returns one exact verified route and its program provenance", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    await activateProgramSnapshot(t, data);
    const result = await t.query((ctx) =>
      runConvexProgram(
        readProgramRoute(ctx, "en", "curriculum/technical-program-1")
      )
    );
    const [program, route] = await Effect.runPromise(
      Effect.all([
        decodeSnapshotRowJson(result.programJson ?? ""),
        decodeSnapshotRowJson(result.routeJson ?? ""),
      ])
    );

    expect(result).toMatchObject({
      activeManifestHash: TEST_MANIFEST_HASH,
      activeReleaseId: TEST_RELEASE_ID,
      ancestorJson: [],
      childJson: [],
      contextJson: [],
      groupJson: [],
      managed: true,
      materialJson: [],
      snapshotId: data.snapshotId,
      sourceRevision: "a".repeat(40),
    });
    expect(program).toMatchObject({
      family: "program",
      record: {
        kind: "program",
        row: { key: "technical-program-1" },
      },
    });
    expect(route).toMatchObject({
      family: "program",
      record: {
        kind: "curriculum",
        row: { locale: "en", programKey: "technical-program-1" },
      },
    });
  });

  it("distinguishes a managed missing route from an unmanaged source", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    await activateProgramSnapshot(t, data);

    await expect(
      t.query((ctx) =>
        runConvexProgram(readProgramRoute(ctx, "id", "kurikulum/missing"))
      )
    ).resolves.toMatchObject({
      managed: true,
      programJson: null,
      routeJson: null,
    });
  });

  it("rejects a curriculum row whose indexed identity drifted", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    await activateProgramSnapshot(t, data);
    await t.mutation(async (ctx) => {
      const row = await ctx.db
        .query("curriculumRoutes")
        .withIndex("by_snapshotId_and_index", (index) =>
          index.eq("snapshotId", data.snapshotId).eq("index", 2)
        )
        .unique();
      if (!row) {
        throw new Error("Expected one active curriculum route.");
      }
      await ctx.db.patch("curriculumRoutes", row._id, {
        programKey: "tampered-program",
      });
    });

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readProgramRoute(ctx, "en", "curriculum/technical-program-1")
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects a material context whose published lesson is missing", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const target = convexTest(schema, convexModules);
    await activateProgramSnapshot(target, data);
    await insertCurriculumRoutes(target, data.snapshotId, [materialContext(1)]);

    await expect(
      target.query((ctx) =>
        runConvexProgram(readProgramRoute(ctx, "en", PROGRAM_ROOT))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects aggregate material fan-out beyond one route budget", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const target = convexTest(schema, convexModules);
    await activateProgramSnapshot(target, data);
    await insertCurriculumRoutes(target, data.snapshotId, [
      materialContext(1),
      materialContext(2),
      materialContext(3),
    ]);
    await insertMaterialGroups(target, [
      { materialIndex: 1, rowCount: 79 },
      { materialIndex: 2, rowCount: 78 },
      { materialIndex: 3, rowCount: 100 },
    ]);

    await expect(
      target.query((ctx) =>
        runConvexProgram(readProgramRoute(ctx, "en", PROGRAM_ROOT))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });

  it("orders material groups by their authored route order", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const target = convexTest(schema, convexModules);
    const earlierGroup = materialGroup(1, 10);
    const laterGroup = materialGroup(2, 20);
    await activateProgramSnapshot(target, data);
    await insertCurriculumRoutes(target, data.snapshotId, [
      earlierGroup,
      laterGroup,
      materialContext(1, laterGroup),
      materialContext(2, earlierGroup),
    ]);
    await insertMaterialGroups(target, [
      { materialIndex: 1, rowCount: 1 },
      { materialIndex: 2, rowCount: 1 },
    ]);

    const result = await target.query((ctx) =>
      runConvexProgram(readProgramRoute(ctx, "en", PROGRAM_ROOT))
    );
    const groups = await Effect.runPromise(
      Effect.forEach(result.groupJson, decodeSnapshotRowJson)
    );

    expect(groups).toMatchObject([
      {
        family: "program",
        record: {
          kind: "curriculum",
          row: { publicPath: earlierGroup.publicPath },
        },
      },
      {
        family: "program",
        record: {
          kind: "curriculum",
          row: { publicPath: laterGroup.publicPath },
        },
      },
    ]);
  });
});
