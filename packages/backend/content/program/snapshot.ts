import { compareCodeUnits } from "@nakafa/aksara-contracts/text/order";
import {
  decodeProgramPosition,
  programPosition,
} from "@repo/backend/content/program/cursor";
import { ProgramSource } from "@repo/backend/content/program/source";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect, Layer, Option } from "effect";

interface ProgramSnapshot {
  readonly curriculumRoutes: readonly PublicationRow<"curriculumRoutes">[];
  readonly programBuckets: readonly PublicationRow<"programBuckets">[];
  readonly programCatalog: readonly PublicationRow<"programCatalog">[];
}

/** Requires one unambiguous immutable program identity. */
const uniqueProgramRow = Effect.fn("program.snapshot.uniqueRow")(function* <
  Row,
>(rows: readonly Row[], identity: string) {
  if (rows.length > 1) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Signed serving snapshot has duplicate program ${identity} rows.`
    );
  }
  return Option.fromUndefinedOr(rows[0]);
});

/** Groups validated rows without changing the source arrays or their ordering. */
function groupRows<Row>(rows: readonly Row[], identity: (row: Row) => string) {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = identity(row);
    const group = groups.get(key);
    if (group) {
      group.push(row);
    } else {
      groups.set(key, [row]);
    }
  }
  return groups;
}

/** Reads immutable program relationships from the verified signed generation. */
export const snapshotProgramLayer = (tables: ProgramSnapshot) =>
  Layer.effect(
    ProgramSource,
    Effect.sync(() => {
      const programs = tables.programCatalog
        .slice()
        .sort((left, right) => left.displayOrder - right.displayOrder);
      const programsBySnapshot = groupRows(programs, (row) => row.snapshotId);
      const programsByKey = groupRows(programs, (row) =>
        JSON.stringify([row.snapshotId, row.programKey])
      );
      const routes = tables.curriculumRoutes
        .slice()
        .sort((left, right) => compareCodeUnits(left.path, right.path));
      const routesBySnapshot = groupRows(routes, (row) =>
        JSON.stringify([row.snapshotId, row.appLocale])
      );
      const routesByPath = groupRows(routes, (row) =>
        JSON.stringify([row.snapshotId, row.appLocale, row.path])
      );
      const routesByNode = groupRows(routes, (row) =>
        JSON.stringify([
          row.snapshotId,
          row.appLocale,
          row.programKey,
          row.nodeKey,
        ])
      );
      const routesByBucket = groupRows(routes, (row) =>
        JSON.stringify([row.snapshotId, row.appLocale, row.bucket])
      );
      const relations = routes
        .slice()
        .sort(
          (left, right) =>
            left.order - right.order || compareCodeUnits(left.path, right.path)
        );
      const children = groupRows(relations, (row) =>
        JSON.stringify([row.snapshotId, row.appLocale, row.parentPath])
      );
      const contexts = groupRows(relations, (row) =>
        JSON.stringify([row.snapshotId, row.appLocale, row.contextPath])
      );
      const buckets = tables.programBuckets
        .slice()
        .sort((left, right) => compareCodeUnits(left.bucket, right.bucket));
      const bucketsByIdentity = groupRows(buckets, (row) =>
        JSON.stringify([row.snapshotId, row.appLocale, row.bucket])
      );
      const bucketsBySnapshot = groupRows(buckets, (row) =>
        JSON.stringify([row.snapshotId, row.appLocale])
      );
      return ProgramSource.of({
        program: Effect.fn("program.snapshot.identity")(
          (snapshotId, programKey) =>
            uniqueProgramRow(
              programsByKey.get(JSON.stringify([snapshotId, programKey])) ?? [],
              programKey
            )
        ),
        programs: Effect.fn("program.snapshot.catalog")((snapshotId, limit) =>
          Effect.sync(() =>
            (programsBySnapshot.get(snapshotId) ?? []).slice(0, limit)
          )
        ),
        route: Effect.fn("program.snapshot.route")(
          (snapshotId, appLocale, publicPath) =>
            uniqueProgramRow(
              routesByPath.get(
                JSON.stringify([snapshotId, appLocale, publicPath])
              ) ?? [],
              `route ${appLocale}/${publicPath}`
            )
        ),
        node: Effect.fn("program.snapshot.node")(
          (snapshotId, appLocale, programKey, nodeKey) =>
            uniqueProgramRow(
              routesByNode.get(
                JSON.stringify([snapshotId, appLocale, programKey, nodeKey])
              ) ?? [],
              `node ${programKey}/${nodeKey}/${appLocale}`
            )
        ),
        related: Effect.fn("program.snapshot.related")(
          (snapshotId, appLocale, relation, publicPath, limit) =>
            Effect.sync(() =>
              (
                (relation === "children" ? children : contexts).get(
                  JSON.stringify([snapshotId, appLocale, publicPath])
                ) ?? []
              ).slice(0, limit)
            )
        ),
        page: Effect.fn("program.snapshot.page")(
          function* (snapshotId, appLocale, options) {
            const position = yield* decodeProgramPosition(
              options.cursor,
              snapshotId,
              appLocale
            );
            const rows = (
              routesBySnapshot.get(JSON.stringify([snapshotId, appLocale])) ??
              []
            ).filter((row) => position === null || row.path > position[2]);
            const page = rows.slice(0, options.numItems);
            const last = page.at(-1);
            return {
              page,
              isDone: rows.length <= options.numItems,
              continueCursor: last
                ? programPosition(last)
                : (options.cursor ?? ""),
            };
          }
        ),
        partition: Effect.fn("program.snapshot.partition")(
          function* (snapshotId, appLocale, bucket, limit) {
            const count = yield* uniqueProgramRow(
              bucketsByIdentity.get(
                JSON.stringify([snapshotId, appLocale, bucket])
              ) ?? [],
              `bucket ${appLocale}/${bucket}`
            );
            const routes = (
              routesByBucket.get(
                JSON.stringify([snapshotId, appLocale, bucket])
              ) ?? []
            ).slice(0, limit);
            return { count, routes };
          }
        ),
        buckets: Effect.fn("program.snapshot.buckets")(
          (snapshotId, appLocale, limit) =>
            Effect.sync(() =>
              (
                bucketsBySnapshot.get(
                  JSON.stringify([snapshotId, appLocale])
                ) ?? []
              ).slice(0, limit)
            )
        ),
      });
    })
  );
