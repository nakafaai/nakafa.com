import { CurriculumRouteSchema } from "@nakafa/aksara-contracts/program/curriculum";
import { makeCurriculumSnapshotRow } from "@nakafa/aksara-contracts/program/snapshot/hash";
import { canonicalizeContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import { insertMaterialProjection } from "@repo/backend/test/material/catalog";
import { Effect, Schema } from "effect";

export const PROGRAM_ROOT = "curriculum/technical-program-1";

export function materialGroup(groupIndex: number, order: number) {
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

export function materialContext(
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

/** Seeds signed curriculum rows with their exact indexed identities. */
export const insertCurriculumRoutes = Effect.fn(
  "test.program.insertCurriculumRoutes"
)(function* (
  snapshotId: string,
  routes: readonly ReturnType<typeof materialContext>[]
) {
  const writer = yield* DatabaseWriter;
  yield* Effect.forEach(
    routes,
    (route, offset) =>
      Effect.gen(function* () {
        const record = yield* makeCurriculumSnapshotRow(route);
        const row = record.row;
        yield* writer.table("curriculumRoutes").insert({
          appLocale: row.appLocale,
          index: 10 + offset,
          level: row.level,
          ...(row.materialContextParentPath === undefined
            ? {}
            : { contextPath: row.materialContextParentPath }),
          ...(row.materialKey === undefined
            ? {}
            : { materialKey: row.materialKey }),
          nodeKey: row.nodeKey,
          order: row.order,
          ...(row.parentPath === undefined
            ? {}
            : { parentPath: row.parentPath }),
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
      }),
    { discard: true }
  );
});

/** Seeds enough material rows to exercise the aggregate route read budget. */
export const insertMaterialGroups = Effect.fn(
  "test.program.insertMaterialGroups"
)(function* (
  groups: readonly {
    readonly materialIndex: number;
    readonly rowCount: number;
  }[]
) {
  for (const { materialIndex, rowCount } of groups) {
    for (let index = 1; index <= rowCount; index += 1) {
      yield* insertMaterialProjection(
        makeMaterialProjection("en", index, materialIndex)
      );
    }
  }
});

export const tamperCurriculumRoute = Effect.fn(
  "test.program.tamperCurriculumRoute"
)(function* (snapshotId: string) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const row = yield* reader
    .table("curriculumRoutes")
    .get("by_snapshotId_and_index", snapshotId, 2);
  yield* writer
    .table("curriculumRoutes")
    .patch(row._id, { programKey: "tampered-program" });
});
