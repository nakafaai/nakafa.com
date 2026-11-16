// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import type { ContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import {
  inheritContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import {
  stageSnapshotBatch,
  verifySnapshotBatch,
  verifySnapshotManifest,
} from "@repo/backend/confect/contentRelease/ingress/snapshot";
import {
  encodeSnapshotJson,
  encodeSnapshotRowJson,
} from "@repo/backend/confect/contentRelease/wire";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import {
  TEST_DIGEST,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content/release";
import { insertTestRelease, runStage } from "@repo/backend/test/content/stage";
import { makeProgramSnapshotData } from "@repo/backend/test/program/snapshot";
import { makeQuranSearch } from "@repo/backend/test/quran/rows";
import {
  makeQuranSnapshot,
  makeQuranSnapshotRow,
} from "@repo/backend/test/quran/snapshot";
import { makeAssessmentTestSnapshot } from "@repo/backend/test/snapshot/assessment";
import { TEST_STAGE_SNAPSHOT } from "@repo/backend/test/snapshot/routes";
import { convexTest } from "convex-test";
import { Effect } from "effect";

/** A Quran search text near the real longest surah's 369 KiB signed row. */
const LONG_SEARCH_TEXT = "a".repeat(360 * 1024);

const otherSnapshotId = Sha256HashSchema.make(`sha256:${"9".repeat(64)}`);

describe("contentRelease/ingress/snapshot", () => {
  it.live(
    "authenticates every structured manifest through its domain hash",
    () =>
      Effect.gen(function* () {
        const program = yield* makeProgramSnapshotData();
        const quran = yield* makeQuranSnapshot();
        const assessment = yield* makeAssessmentTestSnapshot();

        expect(
          yield* Effect.all([
            verifySnapshotManifest(program.snapshot),
            verifySnapshotManifest(quran),
            verifySnapshotManifest(assessment.manifest),
          ])
        ).toEqual([undefined, undefined, undefined]);
      })
  );

  it.live("authenticates every structured row through its domain hash", () =>
    Effect.gen(function* () {
      const program = yield* makeProgramSnapshotData();
      const quran = yield* makeQuranSnapshot();
      const quranRow = yield* makeQuranSnapshotRow(quran.manifest.snapshotId);
      const assessment = yield* makeAssessmentTestSnapshot();

      expect(
        yield* Effect.all([
          verifySnapshotBatch("program", program.snapshotId, program.rows),
          verifySnapshotBatch("quran", quran.manifest.snapshotId, [quranRow]),
          verifySnapshotBatch(
            "assessment",
            assessment.manifest.manifest.snapshotId,
            assessment.rows
          ),
        ])
      ).toEqual([undefined, undefined, undefined]);
    })
  );

  it.live("rejects cross-family and cross-snapshot rows before storage", () =>
    Effect.gen(function* () {
      const program = yield* makeProgramSnapshotData();
      const quran = yield* makeQuranSnapshot();
      const quranRow = yield* makeQuranSnapshotRow(quran.manifest.snapshotId);
      const [programRow] = program.rows;
      if (!programRow) {
        return yield* Effect.die(
          new Error("Expected one technical program row.")
        );
      }

      const crossFamily = yield* verifySnapshotBatch(
        "quran",
        program.snapshotId,
        [programRow]
      ).pipe(Effect.flip);
      const crossSnapshot = yield* verifySnapshotBatch(
        "quran",
        otherSnapshotId,
        [quranRow]
      ).pipe(Effect.flip);
      expect(crossFamily.message).toContain("received a program row");
      expect(crossSnapshot.message).toContain("not bound to snapshot");
    })
  );

  it.live(
    "rejects a tampered assessment manifest or row hash before storage",
    () =>
      Effect.gen(function* () {
        const { manifest, rows } = yield* makeAssessmentTestSnapshot();
        const [row] = rows;
        if (!row) {
          return yield* Effect.die(
            new Error("Expected one technical assessment row.")
          );
        }
        const tampered: ContentSnapshotRow = {
          ...row,
          record: {
            ...row.record,
            rowHash: otherSnapshotId,
          },
        };

        const rowFailure = yield* verifySnapshotBatch(
          "assessment",
          otherSnapshotId,
          [tampered]
        ).pipe(Effect.flip);
        const manifestFailure = yield* verifySnapshotManifest({
          ...manifest,
          manifest: { ...manifest.manifest, snapshotId: otherSnapshotId },
        }).pipe(Effect.flip);
        expect(rowFailure.message).toBe(
          "Assessment snapshot row has an invalid content identity."
        );
        expect(manifestFailure.message).toBe(
          "Assessment snapshot manifest has an invalid content identity."
        );
      })
  );
  it.live(
    "stages a Quran search row near its 369 KiB production size once its manifest is staged",
    () =>
      Effect.gen(function* () {
        const snapshot = yield* makeQuranSnapshot();
        const snapshotId = snapshot.manifest.snapshotId;
        const row = yield* makeQuranSnapshotRow(
          snapshotId,
          makeQuranSearch("en", 2, LONG_SEARCH_TEXT)
        );
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            insertTestRelease(ctx, {
              itemCount: 0,
              projectionCount: 0,
              routeCount: 0,
              snapshots: {
                ...inheritContentSnapshots(null),
                quran: replaceContentSnapshot({
                  baseSnapshotId: null,
                  resultSnapshotId: snapshotId,
                  rowCount: 1,
                  rowDigest: TEST_DIGEST,
                }),
              },
              upsertCount: 0,
            })
          )
        );
        const stage = () =>
          runStage(t, () =>
            stageSnapshotBatch({
              batchIndex: 0,
              family: "quran",
              operation: "stageSnapshotBatch",
              releaseId: TEST_RELEASE_ID,
              rows: [row],
              snapshotId,
            })
          );
        const missing = yield* stage().pipe(Effect.flip);
        expect(getUnknownErrorMessage(missing.cause)).toContain(
          "must be staged before its rows"
        );
        yield* Effect.promise(() =>
          t.mutation(TEST_STAGE_SNAPSHOT, {
            releaseId: TEST_RELEASE_ID,
            snapshotJson: encodeSnapshotJson(snapshot),
          })
        );
        expect(yield* stage()).toMatchObject({ created: 1, unchanged: 0 });
        expect(yield* stage()).toMatchObject({ created: 0, unchanged: 1 });
        const stored = yield* Effect.promise(() =>
          t.run(async (ctx) => ({
            batches: await ctx.db.query("snapshotBatches").collect(),
            rows: await ctx.db.query("quranRows").collect(),
            search: await ctx.db.query("quranSearch").collect(),
          }))
        );
        expect(stored.batches).toHaveLength(1);
        expect(stored.rows).toMatchObject([
          {
            identity: "search:en:2",
            index: 0,
            rowJson: encodeSnapshotRowJson(row),
            snapshotId,
          },
        ]);
        expect(stored.search).toMatchObject([
          { index: 0, snapshotId, text: LONG_SEARCH_TEXT },
        ]);
      })
  );
});
