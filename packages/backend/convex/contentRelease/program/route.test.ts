import { describe, expect, it } from "@effect/vitest";
import { CurriculumRouteSchema } from "@nakafa/aksara-contracts/program/curriculum";
import { makeCurriculumSnapshotRow } from "@nakafa/aksara-contracts/program/snapshot/row-hash";
import { canonicalizeContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import { readProgramRoute } from "@repo/backend/convex/contentRelease/program/route";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content/release";
import {
  activateMaterialCatalog,
  insertMaterialProjection,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material/catalog";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
} from "@repo/backend/test/program/snapshot";
import { convexTest, type TestConvex } from "convex-test";
import { Effect, Schema } from "effect";

const PROGRAM_ROOT = "curriculum/technical-program-1";

class ProgramRouteQueryRejected extends Schema.TaggedError<ProgramRouteQueryRejected>()(
  "ProgramRouteQueryRejected",
  { cause: Schema.Unknown }
) {}

class UnexpectedProgramRouteTestState extends Schema.TaggedError<UnexpectedProgramRouteTestState>()(
  "UnexpectedProgramRouteTestState",
  { operation: Schema.Literal("load-active-curriculum-route") }
) {}

/** Creates one authored material group under the technical root. */
function materialGroup(groupIndex: number, order: number) {
  return Schema.decodeSync(CurriculumRouteSchema)({
    appLocale: "en",
    iconKey: "school",
    kind: "curriculum-context",
    level: "topic",
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
  const material = makeMaterialProjection("en", 1, materialIndex);
  const groupNodeKey = group?.nodeKey ?? `context-${materialIndex}`;
  const groupPath = group?.publicPath ?? PROGRAM_ROOT;
  return Schema.decodeSync(CurriculumRouteSchema)({
    appLocale: "en",
    canonicalPath: material.parentPath,
    iconKey: "school",
    kind: "curriculum-context",
    level: "topic",
    materialContextNodeKey: groupNodeKey,
    materialContextParentPath: PROGRAM_ROOT,
    materialContextPublicPath: groupPath,
    materialKey: material.materialKey,
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
const insertCurriculumRoutes = Effect.fn(
  "contentRelease.program.route.test.insertCurriculumRoutes"
)(function* (
  target: TestConvex<typeof schema>,
  snapshotId: string,
  routes: readonly ReturnType<typeof materialContext>[]
) {
  const records = yield* Effect.forEach(routes, makeCurriculumSnapshotRow);
  yield* Effect.promise(() =>
    target.mutation((ctx) =>
      runConvexProgram(
        Effect.forEach(
          records,
          (record, offset) => {
            const row = record.row;
            return Effect.promise(() =>
              ctx.db.insert("curriculumRoutes", {
                appLocale: row.appLocale,
                index: 10 + offset,
                level: row.level,
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
              })
            );
          },
          { discard: true }
        )
      )
    )
  );
});

/** Inserts material projections in bounded test transactions. */
const insertMaterialGroups = Effect.fn(
  "contentRelease.program.route.test.insertMaterialGroups"
)(function* (
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
    yield* Effect.promise(() =>
      target.mutation((ctx) =>
        runConvexProgram(
          Effect.forEach(
            projections.slice(first, first + 32),
            (projection) =>
              Effect.promise(() => insertMaterialProjection(ctx, projection)),
            { discard: true }
          )
        )
      )
    );
  }
});

/** Corrupts one indexed identity to exercise the read integrity boundary. */
const tamperCurriculumRoute = Effect.fn(
  "contentRelease.program.route.test.tamperCurriculumRoute"
)(function* (ctx: MutationCtx, snapshotId: string) {
  const row = yield* Effect.promise(() =>
    ctx.db
      .query("curriculumRoutes")
      .withIndex("by_snapshotId_and_index", (index) =>
        index.eq("snapshotId", snapshotId).eq("index", 2)
      )
      .unique()
  );
  if (!row) {
    return yield* Effect.die(
      new UnexpectedProgramRouteTestState({
        operation: "load-active-curriculum-route",
      })
    );
  }
  yield* Effect.promise(() =>
    ctx.db.patch("curriculumRoutes", row._id, {
      programKey: "tampered-program",
    })
  );
});

describe("contentRelease/program/route", () => {
  it.effect(
    "returns one exact verified route and its program provenance",
    Effect.fn("contentRelease.program.route.test.returnsExactRoute")(
      function* () {
        const data = yield* makeProgramSnapshotData();
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateProgramSnapshot(t, data));
        const result = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(
              readProgramRoute(ctx, "en", "curriculum/technical-program-1")
            )
          )
        );
        const [program, route] = yield* Effect.all([
          decodeSnapshotRowJson(result.programJson ?? ""),
          decodeSnapshotRowJson(result.routeJson ?? ""),
        ]);

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
            row: { appLocale: "en", programKey: "technical-program-1" },
          },
        });
      }
    )
  );

  it.effect(
    "distinguishes a managed missing route from an unmanaged source",
    Effect.fn("contentRelease.program.route.test.distinguishesMissingRoute")(
      function* () {
        const data = yield* makeProgramSnapshotData();
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateProgramSnapshot(t, data));

        const result = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(readProgramRoute(ctx, "id", "kurikulum/missing"))
          )
        );
        expect(result).toMatchObject({
          managed: true,
          programJson: null,
          routeJson: null,
        });
      }
    )
  );

  it.effect(
    "preserves the active release while programs remain source-owned",
    Effect.fn("contentRelease.program.route.test.preservesActiveRelease")(
      function* () {
        const target = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateMaterialCatalog(target));

        const result = yield* Effect.promise(() =>
          target.query((ctx) =>
            runConvexProgram(
              readProgramRoute(ctx, "en", "curriculum/technical-program-1")
            )
          )
        );
        expect(result).toMatchObject({
          activeReleaseId: MATERIAL_IDENTITY.releaseId,
          managed: false,
          routeJson: null,
        });
      }
    )
  );

  it.effect(
    "rejects a curriculum row whose indexed identity drifted",
    Effect.fn("contentRelease.program.route.test.rejectsDriftedIdentity")(
      function* () {
        const data = yield* makeProgramSnapshotData();
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateProgramSnapshot(t, data));
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(tamperCurriculumRoute(ctx, data.snapshotId))
          )
        );

        const failure = yield* Effect.tryPromise({
          try: () =>
            t.query((ctx) =>
              runConvexProgram(
                readProgramRoute(ctx, "en", "curriculum/technical-program-1")
              )
            ),
          catch: (cause) => new ProgramRouteQueryRejected({ cause }),
        }).pipe(Effect.flip);
        expect(failure.cause).toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        });
      }
    )
  );

  it.effect(
    "omits material projections removed after the program snapshot",
    Effect.fn("contentRelease.program.route.test.omitsRemovedMaterials")(
      function* () {
        const data = yield* makeProgramSnapshotData();
        const target = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateProgramSnapshot(target, data));
        yield* insertCurriculumRoutes(target, data.snapshotId, [
          materialContext(1),
        ]);

        const result = yield* Effect.promise(() =>
          target.query((ctx) =>
            runConvexProgram(readProgramRoute(ctx, "en", PROGRAM_ROOT))
          )
        );
        expect(result).toMatchObject({
          managed: true,
          materialJson: [],
        });
      }
    )
  );

  it.effect(
    "rejects aggregate material fan-out beyond one route budget",
    Effect.fn("contentRelease.program.route.test.rejectsMaterialFanOut")(
      function* () {
        const data = yield* makeProgramSnapshotData();
        const target = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateProgramSnapshot(target, data));
        yield* insertCurriculumRoutes(target, data.snapshotId, [
          materialContext(1),
          materialContext(2),
          materialContext(3),
        ]);
        yield* insertMaterialGroups(target, [
          { materialIndex: 1, rowCount: 79 },
          { materialIndex: 2, rowCount: 78 },
          { materialIndex: 3, rowCount: 100 },
        ]);

        const failure = yield* Effect.tryPromise({
          try: () =>
            target.query((ctx) =>
              runConvexProgram(readProgramRoute(ctx, "en", PROGRAM_ROOT))
            ),
          catch: (cause) => new ProgramRouteQueryRejected({ cause }),
        }).pipe(Effect.flip);
        expect(failure.cause).toMatchObject({
          data: { code: "CONTENT_RELEASE_LIMIT" },
        });
      }
    )
  );

  it.effect(
    "orders material groups by their authored route order",
    Effect.fn("contentRelease.program.route.test.ordersAuthoredGroups")(
      function* () {
        const data = yield* makeProgramSnapshotData();
        const target = convexTest(schema, convexModules);
        const earlierGroup = materialGroup(1, 10);
        const laterGroup = materialGroup(2, 20);
        yield* Effect.promise(() => activateProgramSnapshot(target, data));
        yield* insertCurriculumRoutes(target, data.snapshotId, [
          earlierGroup,
          laterGroup,
          materialContext(1, laterGroup),
          materialContext(2, earlierGroup),
        ]);
        yield* insertMaterialGroups(target, [
          { materialIndex: 1, rowCount: 1 },
          { materialIndex: 2, rowCount: 1 },
        ]);

        const result = yield* Effect.promise(() =>
          target.query((ctx) =>
            runConvexProgram(readProgramRoute(ctx, "en", PROGRAM_ROOT))
          )
        );
        const groups = yield* Effect.forEach(
          result.groupJson,
          decodeSnapshotRowJson
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
      }
    )
  );
});
