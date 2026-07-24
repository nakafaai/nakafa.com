// @vitest-environment node

import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import type { ContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot-data";
import {
  verifySnapshotBatch,
  verifySnapshotManifest,
} from "@repo/backend/convex/contentRelease/ingress/snapshot";
import { makeProgramSnapshotData } from "@repo/backend/test/content-snapshot";
import {
  makeQuranSnapshot,
  makeQuranSnapshotRow,
} from "@repo/backend/test/quran-snapshot";
import {
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
  makeTryoutSnapshotManifest,
} from "@repo/backend/test/tryout-snapshot";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const otherSnapshotId = Sha256HashSchema.make(`sha256:${"9".repeat(64)}`);

describe("contentRelease/ingress/snapshot", () => {
  it("authenticates every structured manifest through its domain hash", async () => {
    const program = await Effect.runPromise(makeProgramSnapshotData());
    const quran = await Effect.runPromise(makeQuranSnapshot());
    const tryout = await Effect.runPromise(makeTryoutSnapshotManifest());

    await expect(
      Effect.runPromise(
        Effect.all([
          verifySnapshotManifest(program.snapshot),
          verifySnapshotManifest(quran),
          verifySnapshotManifest(tryout),
        ])
      )
    ).resolves.toEqual([undefined, undefined, undefined]);
  });

  it("authenticates every structured row through its domain hash", async () => {
    const program = await Effect.runPromise(makeProgramSnapshotData());
    const quran = await Effect.runPromise(makeQuranSnapshot());
    const quranRow = await Effect.runPromise(
      makeQuranSnapshotRow(quran.manifest.snapshotId)
    );
    const tryout = await Effect.runPromise(makeTryoutSnapshotManifest());
    const catalog = makeTryoutCatalogRow();
    const placement = makeTryoutPlacementRow();

    await expect(
      Effect.runPromise(
        Effect.all([
          verifySnapshotBatch("program", program.snapshotId, program.rows),
          verifySnapshotBatch("quran", quran.manifest.snapshotId, [quranRow]),
          verifySnapshotBatch("tryout", tryout.manifest.snapshotId, [
            catalog,
            placement,
          ]),
        ])
      )
    ).resolves.toEqual([undefined, undefined, undefined]);
  });

  it("rejects cross-family and cross-snapshot rows before storage", async () => {
    const program = await Effect.runPromise(makeProgramSnapshotData());
    const quran = await Effect.runPromise(makeQuranSnapshot());
    const quranRow = await Effect.runPromise(
      makeQuranSnapshotRow(quran.manifest.snapshotId)
    );
    const [programRow] = program.rows;
    if (!programRow) {
      throw new Error("Expected one technical program row.");
    }

    await expect(
      Effect.runPromise(
        verifySnapshotBatch("quran", program.snapshotId, [programRow])
      )
    ).rejects.toThrow("received a program row");
    await expect(
      Effect.runPromise(
        verifySnapshotBatch("quran", otherSnapshotId, [quranRow])
      )
    ).rejects.toThrow("not bound to snapshot");
  });

  it("rejects a tampered try-out row hash before storage", async () => {
    const row = makeTryoutCatalogRow();
    const tampered: ContentSnapshotRow = {
      ...row,
      record: {
        ...row.record,
        rowHash: otherSnapshotId,
      },
    };

    await expect(
      Effect.runPromise(
        verifySnapshotBatch("tryout", otherSnapshotId, [tampered])
      )
    ).rejects.toThrow("invalid content identity");
  });
});
