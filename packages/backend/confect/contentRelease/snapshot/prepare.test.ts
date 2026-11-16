import { assert, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema, type Sha256Hash } from "@nakafa/aksara-contracts/ids";
import {
  type ContentSnapshotRow,
  contentSnapshotId,
} from "@nakafa/aksara-contracts/release/snapshot/data";
import {
  inheritContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import { MAX_SNAPSHOT_BATCH_COUNT } from "@nakafa/aksara-contracts/transport/limits";
import { hashBatch } from "@repo/backend/confect/contentRelease/batch";
import { prepareSnapshotStage } from "@repo/backend/confect/contentRelease/snapshot/prepare";
import {
  encodeSnapshotJson,
  encodeSnapshotRowJson,
} from "@repo/backend/confect/contentRelease/wire";
import {
  TEST_DIGEST,
  TEST_MANIFEST_HASH,
  testReleaseJson,
} from "@repo/backend/test/content/release";
import { makeProgramSnapshotData } from "@repo/backend/test/program/snapshot";
import {
  makeQuranChunk,
  makeQuranSearch,
  makeQuranSurah,
} from "@repo/backend/test/quran/rows";
import {
  makeQuranSnapshot,
  makeQuranSnapshotRow,
} from "@repo/backend/test/quran/snapshot";
import { makeAssessmentTestSnapshot } from "@repo/backend/test/snapshot/assessment";
import { Array as Arr, Effect } from "effect";

const releaseId = ReleaseIdSchema.make("release-prepare");

/** A Quran search text near the real longest surah's 369 KiB signed row. */
const LONG_SEARCH_TEXT = "a".repeat(360 * 1024);

/** Stores one replacement of a family as the signed release names it. */
function replacing(
  family: ContentSnapshotRow["family"],
  resultSnapshotId: Sha256Hash,
  rowCount: number
) {
  return testReleaseJson({
    releaseId,
    snapshots: {
      ...inheritContentSnapshots(null),
      [family]: replaceContentSnapshot({
        baseSnapshotId: null,
        resultSnapshotId,
        rowCount,
        rowDigest: TEST_DIGEST,
      }),
    },
  });
}

/** Prepares Quran rows against a release that replaces the Quran snapshot. */
const prepareQuran = Effect.fn("test.prepare.quran")(function* (
  payloads: readonly Parameters<typeof makeQuranSnapshotRow>[1][]
) {
  const snapshot = yield* makeQuranSnapshot();
  const snapshotId = contentSnapshotId(snapshot);
  const rows = yield* Effect.forEach(payloads, (payload) =>
    makeQuranSnapshotRow(snapshotId, payload)
  );
  assert(Arr.isReadonlyArrayNonEmpty(rows), "Expected Quran rows.");
  return yield* prepareSnapshotStage(
    { batchIndex: 0, family: "quran", releaseId, rows, snapshotId },
    {
      releaseJson: replacing("quran", snapshotId, rows.length),
      snapshotJson: encodeSnapshotJson(snapshot),
    }
  );
});

describe("contentRelease/snapshot/prepare", () => {
  it.effect(
    "prepares every program row with the hash a byte-identical retry must match",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const [first, ...rest] = data.rows;
        assert(first, "Expected program rows.");
        const rows = Arr.prepend(
          Arr.take(rest, MAX_SNAPSHOT_BATCH_COUNT - 1),
          first
        );
        const args = yield* prepareSnapshotStage(
          {
            batchIndex: 2,
            family: "program",
            releaseId,
            rows,
            snapshotId: data.snapshotId,
          },
          {
            releaseJson: replacing("program", data.snapshotId, 40),
            snapshotJson: data.manifestJson,
          }
        );
        const rowJson = Arr.map(rows, encodeSnapshotRowJson);
        expect(args).toMatchObject({
          batchHash: yield* hashBatch("snapshot", releaseId, 2, [
            "program",
            data.snapshotId,
            ...rowJson,
          ]),
          batchIndex: 2,
          familyRows: 40,
          family: "program",
          manifestHash: TEST_MANIFEST_HASH,
          releaseId,
          snapshotId: data.snapshotId,
          totalRows: 40,
        });
        expect(Arr.map(args.rows, ({ document }) => document.rowJson)).toEqual(
          rowJson
        );
        expect(args.rows[0]).toEqual({
          document: {
            displayOrder: 10,
            programKey: "technical-program-1",
            rowHash: first.record.rowHash,
            rowJson: rowJson[0],
          },
          kind: "program",
        });
        expect(
          Arr.filter(args.rows, ({ kind }) => kind === "curriculum").length
        ).toBe(rows.length - 2);
      })
  );

  it.effect(
    "prepares a Quran search row near its ceiling, with its search document",
    () =>
      Effect.gen(function* () {
        const args = yield* prepareQuran([
          makeQuranSearch("en", 2, LONG_SEARCH_TEXT),
          makeQuranSurah(2),
          makeQuranChunk({
            firstQuranNumber: 1,
            firstVerse: 1,
            surahNumber: 1,
            verseCount: 1,
          }),
        ]);
        const [search, surah, chunk] = args.rows;
        expect(search).toMatchObject({
          document: { identity: "search:en:2", kind: "quran-search" },
          kind: "quran",
          search: {
            appLocale: "en",
            identity: "search:en:2",
            surahNumber: 2,
            text: LONG_SEARCH_TEXT,
          },
        });
        expect(surah).toMatchObject({
          document: { identity: "surah:2", kind: "quran-surah" },
          kind: "quran",
        });
        expect(surah).not.toHaveProperty("search");
        expect(chunk).toMatchObject({
          document: { firstVerse: 1, identity: "chunk:1:1" },
          kind: "quran",
        });
      })
  );

  it.effect("prepares assessment rows with their indexed facts", () =>
    Effect.gen(function* () {
      const { manifest, rows } = yield* makeAssessmentTestSnapshot();
      const [first] = rows;
      assert(first, "Expected assessment rows.");
      const snapshotId = contentSnapshotId(manifest);
      const args = yield* prepareSnapshotStage(
        {
          batchIndex: 0,
          family: "assessment",
          releaseId,
          rows: [first],
          snapshotId,
        },
        {
          releaseJson: replacing("assessment", snapshotId, rows.length),
          snapshotJson: encodeSnapshotJson(manifest),
        }
      );
      expect(args.rows).toEqual([
        {
          document: expect.objectContaining({
            rowHash: first.record.rowHash,
            rowJson: encodeSnapshotRowJson(first),
          }),
          kind: "assessment",
        },
      ]);
    })
  );

  it.effect("rejects batches beyond the transport contract", () =>
    Effect.gen(function* () {
      const tooMany = yield* prepareQuran(
        Arr.makeBy(MAX_SNAPSHOT_BATCH_COUNT + 1, (index) =>
          makeQuranSurah(index + 1)
        )
      ).pipe(Effect.flip);
      const tooLarge = yield* prepareQuran([
        makeQuranSearch("en", 2, LONG_SEARCH_TEXT),
        makeQuranSearch("id", 2, LONG_SEARCH_TEXT),
      ]).pipe(Effect.flip);
      expect([tooMany.code, tooLarge.code]).toEqual([
        "CONTENT_RELEASE_LIMIT",
        "CONTENT_RELEASE_LIMIT",
      ]);
    })
  );

  it.effect("rejects a Quran search row with a noncanonical route", () =>
    Effect.gen(function* () {
      const failure = yield* prepareQuran([
        { ...makeQuranSearch("en", 2), route: makeQuranSearch("en", 3).route },
      ]).pipe(Effect.flip);
      expect(failure).toMatchObject({
        code: "CONTENT_RELEASE_INTEGRITY",
        message: "Quran search row 0 of batch 0 has a noncanonical route.",
      });
    })
  );

  it.effect(
    "rejects a batch its signed release does not stage, or whose manifest lost its identity",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const quran = yield* makeQuranSnapshot();
        const quranId = contentSnapshotId(quran);
        const [first] = data.rows;
        assert(first, "Expected program rows.");
        const input = {
          batchIndex: 0,
          family: "program",
          releaseId,
          rows: [first],
          snapshotId: data.snapshotId,
        } as const;
        const failures = yield* Effect.forEach(
          [
            {
              releaseJson: testReleaseJson({ releaseId }),
              snapshotJson: data.manifestJson,
            },
            {
              releaseJson: replacing("program", TEST_DIGEST, 1),
              snapshotJson: data.manifestJson,
            },
            {
              releaseJson: replacing("program", data.snapshotId, 1),
              snapshotJson: encodeSnapshotJson(quran),
            },
          ],
          (stored) => prepareSnapshotStage(input, stored).pipe(Effect.flip)
        );
        const otherFamily = yield* prepareSnapshotStage(
          { ...input, snapshotId: quranId },
          {
            releaseJson: replacing("program", quranId, 1),
            snapshotJson: encodeSnapshotJson(quran),
          }
        ).pipe(Effect.flip);
        expect(Arr.map([...failures, otherFamily], ({ code }) => code)).toEqual(
          [
            "CONTENT_RELEASE_STATE",
            "CONTENT_RELEASE_STATE",
            "CONTENT_RELEASE_INTEGRITY",
            "CONTENT_RELEASE_INTEGRITY",
          ]
        );
      })
  );
});
