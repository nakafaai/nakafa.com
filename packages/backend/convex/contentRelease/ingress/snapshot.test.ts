// @vitest-environment node

import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import type { ContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import {
  verifySnapshotBatch,
  verifySnapshotManifest,
} from "@repo/backend/convex/contentRelease/ingress/snapshot";
import { makeProgramSnapshotData } from "@repo/backend/test/program-snapshot";
import {
  makeQuranSnapshot,
  makeQuranSnapshotRow,
} from "@repo/backend/test/quran-snapshot";
import {
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
  makeTryoutSnapshotManifest,
} from "@repo/backend/test/tryout-snapshot";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";

const otherSnapshotId = Sha256HashSchema.make(`sha256:${"9".repeat(64)}`);

describe("contentRelease/ingress/snapshot", () => {
  it.live(
    "authenticates every structured manifest through its domain hash",
    () =>
      Effect.gen(function* () {
        const program = yield* makeProgramSnapshotData();
        const quran = yield* makeQuranSnapshot();
        const tryout = yield* makeTryoutSnapshotManifest();

        expect(
          yield* Effect.all([
            verifySnapshotManifest(program.snapshot),
            verifySnapshotManifest(quran),
            verifySnapshotManifest(tryout),
          ])
        ).toEqual([undefined, undefined, undefined]);
      })
  );

  it.live("authenticates every structured row through its domain hash", () =>
    Effect.gen(function* () {
      const program = yield* makeProgramSnapshotData();
      const quran = yield* makeQuranSnapshot();
      const quranRow = yield* makeQuranSnapshotRow(quran.manifest.snapshotId);
      const tryout = yield* makeTryoutSnapshotManifest();
      const catalog = makeTryoutCatalogRow();
      const placement = makeTryoutPlacementRow();

      expect(
        yield* Effect.all([
          verifySnapshotBatch("program", program.snapshotId, program.rows),
          verifySnapshotBatch("quran", quran.manifest.snapshotId, [quranRow]),
          verifySnapshotBatch("tryout", tryout.manifest.snapshotId, [
            catalog,
            placement,
          ]),
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

  it.live("rejects a tampered try-out row hash before storage", () =>
    Effect.gen(function* () {
      const row = makeTryoutCatalogRow();
      const tampered: ContentSnapshotRow = {
        ...row,
        record: {
          ...row.record,
          rowHash: otherSnapshotId,
        },
      };

      const failure = yield* verifySnapshotBatch("tryout", otherSnapshotId, [
        tampered,
      ]).pipe(Effect.flip);
      expect(failure.message).toContain("invalid content identity");
    })
  );
});
