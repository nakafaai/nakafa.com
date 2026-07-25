import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { canonicalizeContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot-data";
import { stageQuranRow } from "@repo/backend/convex/contentRelease/snapshot/quran";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeQuranSnapshotRow } from "@repo/backend/test/quran-snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const snapshotId = Sha256HashSchema.make(`sha256:${"7".repeat(64)}`);

describe("contentRelease/snapshot/quran", () => {
  it("stores one snapshot-bound Quran row idempotently", async () => {
    const source = await Effect.runPromise(makeQuranSnapshotRow(snapshotId));
    const rowJson = canonicalizeContentSnapshotRow(source);
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(stageQuranRow(ctx, snapshotId, 0, source, rowJson))
      )
    ).resolves.toBe(false);
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(stageQuranRow(ctx, snapshotId, 0, source, rowJson))
      )
    ).resolves.toBe(true);
    await expect(
      t.run((ctx) => ctx.db.query("quranRows").unique())
    ).resolves.toMatchObject({
      identity: "search:en:1",
      kind: "quran-search",
      locale: "en",
      surahNumber: 1,
    });
  });

  it("rejects cross-snapshot rows and identity collisions", async () => {
    const source = await Effect.runPromise(makeQuranSnapshotRow(snapshotId));
    const rowJson = canonicalizeContentSnapshotRow(source);
    const otherId = Sha256HashSchema.make(`sha256:${"8".repeat(64)}`);
    const wrong = convexTest(schema, convexModules);
    await expect(
      wrong.mutation((ctx) =>
        runConvexProgram(stageQuranRow(ctx, otherId, 0, source, rowJson))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });

    const collision = convexTest(schema, convexModules);
    await collision.mutation((ctx) =>
      runConvexProgram(stageQuranRow(ctx, snapshotId, 0, source, rowJson))
    );
    await expect(
      collision.mutation((ctx) =>
        runConvexProgram(stageQuranRow(ctx, snapshotId, 1, source, rowJson))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
  });
});
