import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { stageProgramRow } from "@repo/backend/convex/contentRelease/snapshot/program";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  testEmptyManifest,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import { testPublicationScope } from "@repo/backend/test/content/release";
import { makeRuntimeSource } from "@repo/backend/test/content/snapshot";
import { makeProgramSnapshotData } from "@repo/backend/test/program/snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";

/** Creates the complete active program publication and its indexed consumer rows. */
export const makeProgramRuntimeSource = Effect.fn(
  "RuntimeSnapshotTest.programSource"
)(function* () {
  const data = yield* makeProgramSnapshotData();
  const t = convexTest(schema, convexModules);
  yield* Effect.promise(() =>
    t.mutation(async (ctx) => {
      for (const [index, row] of data.rows.entries()) {
        await runConvexProgram(
          stageProgramRow(ctx, data.snapshotId, index, row, JSON.stringify(row))
        );
      }
    })
  );
  const signed = testSignedRelease({
    ...testEmptyManifest(ReleaseIdSchema.make("program-active")),
    scope: testPublicationScope({ snapshots: data.snapshots }),
    snapshots: data.snapshots,
  });
  const fixture = makeRuntimeSource(signed, signed.manifest.scope.families);
  fixture.source.set("contentSnapshots", [
    {
      createdAt: 1,
      family: "program",
      retainUntil: 100,
      snapshotId: data.snapshotId,
      snapshotJson: data.manifestJson,
      verifiedAt: 1,
    },
  ]);
  for (const table of [
    "programCatalog",
    "curriculumRoutes",
    "programBuckets",
  ] as const) {
    fixture.source.set(
      table,
      yield* Effect.promise(() =>
        t.query((ctx) => ctx.db.query(table).collect())
      )
    );
  }
  return { ...fixture, data };
});
