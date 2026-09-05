import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { ACTIVE_APP_LOCALES } from "@nakafa/aksara-contracts/locale";
import { digestProgramRows } from "@nakafa/aksara-contracts/program/snapshot/digest";
import { makeProgramSnapshot } from "@nakafa/aksara-contracts/program/snapshot/hash";
import {
  makeCurriculumSnapshotRow,
  makeProgramSnapshotRow,
} from "@nakafa/aksara-contracts/program/snapshot/row-hash";
import {
  type ContentSnapshotManifest,
  canonicalizeContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot/data";
import {
  inheritContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import { compareCodeUnits } from "@nakafa/aksara-contracts/text/order";
import type { RuntimeRow } from "@repo/backend/content/snapshot/tables";
import { getHashBucket } from "@repo/backend/convex/contentRelease/bucket";
import { encodeSnapshotJson } from "@repo/backend/convex/contentRelease/wire";
import {
  testEmptyManifest,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import { testPublicationScope } from "@repo/backend/test/content/release";
import { makeRuntimeSource } from "@repo/backend/test/content/snapshot";
import { Array as Arr, Effect, Stream, Struct } from "effect";
import {
  testPublishedCurriculumRoutes,
  testPublishedProgram,
} from "@/test/content-program";

/** Authenticates the existing curriculum fixture, including its material return context. */
export const makeProgramContextRuntimeSource = Effect.fn(
  "TestContent.programContextRuntimeSource"
)(function* () {
  const catalog = yield* makeProgramSnapshotRow(testPublishedProgram);
  const routes = [...testPublishedCurriculumRoutes].sort((left, right) =>
    compareCodeUnits(
      `${left.programKey}\0${left.appLocale}\0${left.publicPath}`,
      `${right.programKey}\0${right.appLocale}\0${right.publicPath}`
    )
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
  fixture.source.set("contentSnapshots", [
    {
      createdAt: 1,
      family: "program",
      retainUntil: 100,
      snapshotId: manifest.snapshotId,
      snapshotJson: encodeSnapshotJson(snapshot),
      verifiedAt: 1,
    },
  ]);
  fixture.source.set("programCatalog", [
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
  const storedRoutes: RuntimeRow<"curriculumRoutes">[] = curriculum.map(
    (record, index) => ({
      ...Struct.pick(record.row, ["materialKey", "parentPath"]),
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
  const sitemapRows = storedRoutes.flatMap((row) =>
    row.bucket === undefined ? [] : [{ ...row, bucket: row.bucket }]
  );
  const buckets = Object.values(
    Arr.groupBy(sitemapRows, (row) => `${row.appLocale}/${row.bucket}`)
  ).map((rows) => ({
    appLocale: rows[0].appLocale,
    bucket: rows[0].bucket,
    index: rows[0].index,
    routeCount: rows.length,
    snapshotId: manifest.snapshotId,
  }));
  fixture.source.set("curriculumRoutes", storedRoutes);
  fixture.source.set("programBuckets", buckets);
  return fixture;
});
