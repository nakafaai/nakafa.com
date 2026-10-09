import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { ACTIVE_APP_LOCALES } from "@nakafa/aksara-contracts/locale";
import { digestProgramRows } from "@nakafa/aksara-contracts/program/snapshot/digest";
import {
  makeCurriculumSnapshotRow,
  makeProgramSnapshot,
  makeProgramSnapshotRow,
} from "@nakafa/aksara-contracts/program/snapshot/hash";
import {
  type ContentSnapshotManifest,
  canonicalizeContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot/data";
import {
  inheritContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import { getHashBucket } from "@repo/backend/confect/contentRelease/bucket";
import { encodeSnapshotJson } from "@repo/backend/confect/contentRelease/wire";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import {
  testEmptyManifest,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import { makeRuntimeSource } from "@repo/backend/test/content/publication";
import { testPublicationScope } from "@repo/backend/test/content/release";
import {
  Array as Arr,
  Effect,
  MutableHashMap,
  Order,
  Record as Rec,
  Stream,
} from "effect";
import {
  testPublishedCurriculumRoutes,
  testPublishedProgram,
} from "@/test/content-program";

/** Authenticates the existing curriculum fixture, including its material return context. */
export const makeProgramContextRuntimeSource = Effect.fn(
  "TestContent.programContextRuntimeSource"
)(function* () {
  const catalog = yield* makeProgramSnapshotRow(testPublishedProgram);
  const routes = Arr.sortWith(
    testPublishedCurriculumRoutes,
    (route) => `${route.programKey}\0${route.appLocale}\0${route.publicPath}`,
    Order.String
  );
  const curriculum = yield* Effect.forEach(routes, makeCurriculumSnapshotRow);
  const evidence = yield* digestProgramRows({
    activeAppLocales: ACTIVE_APP_LOCALES,
    rows: Stream.fromIterable([catalog, ...curriculum]),
  });
  const manifest = yield* makeProgramSnapshot({
    activeAppLocales: ACTIVE_APP_LOCALES,
    ...evidence,
  });
  const snapshot: ContentSnapshotManifest = { family: "program", manifest };
  const snapshots = {
    ...inheritContentSnapshots(null),
    program: replaceContentSnapshot({
      baseSnapshotId: null,
      resultSnapshotId: manifest.snapshotId,
      rowCount: evidence.rowCount,
      rowDigest: evidence.rowDigest,
    }),
  };
  const signed = testSignedRelease({
    ...testEmptyManifest(ReleaseIdSchema.make("app-program-context-snapshot")),
    scope: testPublicationScope({ families: ["material"], snapshots }),
    snapshots,
  });
  const fixture = makeRuntimeSource(signed, signed.manifest.scope.families);
  MutableHashMap.set(fixture.source, "contentSnapshots", [
    {
      createdAt: 1,
      family: "program",
      retainUntil: 100,
      snapshotId: manifest.snapshotId,
      snapshotJson: encodeSnapshotJson(snapshot),
      verifiedAt: 1,
    },
  ]);
  MutableHashMap.set(fixture.source, "programCatalog", [
    {
      displayOrder: catalog.row.displayOrder,
      index: 0,
      programKey: catalog.row.key,
      rowHash: catalog.rowHash,
      rowJson: canonicalizeContentSnapshotRow({
        family: "program",
        record: catalog,
      }),
      snapshotId: manifest.snapshotId,
    },
  ]);
  const storedRoutes: PublicationRow<"curriculumRoutes">[] = Arr.map(
    curriculum,
    (record, index) => ({
      ...(record.row.materialKey === undefined
        ? {}
        : { materialKey: record.row.materialKey }),
      ...(record.row.parentPath === undefined
        ? {}
        : { parentPath: record.row.parentPath }),
      ...(record.row.sitemap ? { bucket: getHashBucket(record.rowHash) } : {}),
      ...(record.row.materialContextParentPath === undefined
        ? {}
        : { contextPath: record.row.materialContextParentPath }),
      appLocale: record.row.appLocale,
      index: index + 1,
      level: record.row.level,
      nodeKey: record.row.nodeKey,
      order: record.row.order,
      path: record.row.publicPath,
      programKey: record.row.programKey,
      rowHash: record.rowHash,
      rowJson: canonicalizeContentSnapshotRow({ family: "program", record }),
      snapshotId: manifest.snapshotId,
      sourcePath: record.row.sourcePath,
    })
  );
  const sitemapRows = Arr.flatMap(storedRoutes, (row) =>
    row.bucket === undefined ? [] : [{ ...row, bucket: row.bucket }]
  );
  const buckets = Arr.map(
    Rec.values(
      Arr.groupBy(sitemapRows, (row) => `${row.appLocale}/${row.bucket}`)
    ),
    (rows) => ({
      appLocale: rows[0].appLocale,
      bucket: rows[0].bucket,
      index: rows[0].index,
      routeCount: rows.length,
      snapshotId: manifest.snapshotId,
    })
  );
  MutableHashMap.set(fixture.source, "curriculumRoutes", storedRoutes);
  MutableHashMap.set(fixture.source, "programBuckets", buckets);
  return fixture;
});
