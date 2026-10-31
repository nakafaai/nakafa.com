import { describe, expect, it } from "@effect/vitest";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { canonicalizeContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import { assessmentRowFacts } from "@repo/backend/confect/contentRelease/assessment/facts";
import { verifyAssessmentRow } from "@repo/backend/confect/contentRelease/assessment/verify";
import { makeQuranSnapshotRow } from "@repo/backend/test/quran/snapshot";
import { makeAssessmentTestSnapshot } from "@repo/backend/test/snapshot/assessment";
import { Array as Arr, Effect } from "effect";

const snapshotId = Sha256HashSchema.make(`sha256:${"7".repeat(64)}`);

/** Stores one fixture row of the given kind as the ingress mutation does. */
const storedRow = Effect.fn("test.assessment.storedRow")(function* (
  kind: "catalog" | "explanation"
) {
  const { rows } = yield* makeAssessmentTestSnapshot();
  const row = yield* Effect.fromOption(
    Arr.findFirst(rows, ({ record }) => record.row.kind === kind)
  );
  return {
    decoded: row.record.row,
    stored: {
      ...assessmentRowFacts(row.record.row),
      index: 0,
      rowHash: row.record.rowHash,
      rowJson: canonicalizeContentSnapshotRow(row),
      snapshotId,
    },
  };
});

describe("contentRelease/assessment/verify", () => {
  it.effect.each(["catalog", "explanation"] as const)(
    "returns the signed %s row when every stored fact matches",
    (kind) =>
      Effect.gen(function* () {
        const { decoded, stored } = yield* storedRow(kind);
        expect(yield* verifyAssessmentRow(stored, snapshotId)).toEqual(decoded);
      })
  );

  it.effect("refuses a row bound to another snapshot or another hash", () =>
    Effect.gen(function* () {
      const { stored } = yield* storedRow("catalog");
      const quran = yield* makeQuranSnapshotRow(snapshotId);
      for (const row of [
        { ...stored, snapshotId: `sha256:${"8".repeat(64)}` },
        { ...stored, rowHash: `sha256:${"9".repeat(64)}` },
        { ...stored, rowJson: canonicalizeContentSnapshotRow(quran) },
      ]) {
        expect(
          yield* verifyAssessmentRow(row, snapshotId).pipe(Effect.flip)
        ).toMatchObject({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Assessment row ${stored.identity} lost its signed snapshot.`,
        });
      }
    })
  );

  it.effect("refuses a row whose stored facts changed", () =>
    Effect.gen(function* () {
      const { stored } = yield* storedRow("explanation");
      for (const row of [
        { ...stored, language: "fr" },
        { ...stored, versionHash: `sha256:${"9".repeat(64)}` },
        { ...stored, order: 2 },
      ]) {
        expect(
          yield* verifyAssessmentRow(row, snapshotId).pipe(Effect.flip)
        ).toMatchObject({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Assessment row ${stored.identity} changed its indexed facts.`,
        });
      }
    })
  );
});
