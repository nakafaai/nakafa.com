import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { stageProgramRow } from "@repo/backend/confect/contentRelease/snapshot/program";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  testEmptyManifest,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import { makeRuntimeSource } from "@repo/backend/test/content/publication";
import { testPublicationScope } from "@repo/backend/test/content/release";
import { makeProgramSnapshotData } from "@repo/backend/test/program/snapshot";
import { Effect, MutableHashMap } from "effect";

/** Creates the complete active program publication and its indexed consumer rows. */
export const makeProgramRuntimeSource = Effect.fn(
  "RuntimeSnapshotTest.programSource"
)(function* () {
  const confect = yield* Confect;
  const data = yield* makeProgramSnapshotData();
  yield* confect.run(
    Effect.forEach(
      data.rows,
      (row, index) =>
        stageProgramRow(data.snapshotId, index, row, data.rowJson[index]),
      { discard: true }
    )
  );
  const signed = testSignedRelease({
    ...testEmptyManifest(ReleaseIdSchema.make("program-active")),
    scope: testPublicationScope({
      snapshots: data.snapshots,
    }),
    snapshots: data.snapshots,
  });
  const fixture = makeRuntimeSource(signed, signed.manifest.scope.families);
  MutableHashMap.set(fixture.source, "contentSnapshots", [
    {
      createdAt: 1,
      family: "program",
      retainUntil: 100,
      snapshotId: data.snapshotId,
      snapshotJson: data.manifestJson,
      verifiedAt: 1,
    },
  ]);
  yield* confect.run(
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      for (const table of [
        "programCatalog",
        "curriculumRoutes",
        "programBuckets",
      ] as const) {
        const rows = yield* reader
          .table(table)
          .index("by_creation_time")
          .collect();
        MutableHashMap.set(fixture.source, table, rows);
      }
    })
  );
  return {
    ...fixture,
    data,
  };
}, Effect.provide(confectLayer));
