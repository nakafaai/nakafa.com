// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import type { ContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import {
  verifySnapshotBatch,
  verifySnapshotManifest,
} from "@repo/backend/confect/contentRelease/ingress/snapshot";
import { makeProgramSnapshotData } from "@repo/backend/test/program/snapshot";
import {
  makeQuranSnapshot,
  makeQuranSnapshotRow,
} from "@repo/backend/test/quran/snapshot";
import { makeAssessmentTestSnapshot } from "@repo/backend/test/snapshot/assessment";
import { Effect } from "effect";

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
});
