import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import {
  completedReceipt,
  makePublicationReceipt,
  publicationReceipt,
  stagedEvidence,
} from "@repo/backend/convex/contentRelease/receipt";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { insertTestRelease } from "@repo/backend/test/content-stage";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

/** Loads one typed release row and its decoded immutable manifest. */
async function fixture() {
  const t = convexTest(schema, convexModules);
  await t.mutation((ctx) => insertTestRelease(ctx));
  const release = await t.run((ctx) =>
    ctx.db.query("contentReleases").unique()
  );
  if (!release) {
    throw new Error("Expected receipt release fixture.");
  }
  const signed = await Effect.runPromise(
    decodeReleaseJson(release.releaseJson)
  );
  return { release, signed };
}

/** Creates a fully staged and verified one-item release row. */
function verifiedRelease(release: Doc<"contentReleases">) {
  return {
    ...release,
    checkedIndex: 0,
    checkedItems: 1,
    proofAt: 1,
    proofJson: "{}",
    stagedArtifacts: 1,
    stagedItems: 1,
    stagedProjections: 1,
    stagedRoutes: 1,
    stagedUpserts: 1,
    status: "verified",
    verifiedAt: 1,
  } satisfies Doc<"contentReleases">;
}

/** Asserts that one durable evidence program fails closed. */
function expectIntegrity<A>(program: Effect.Effect<A, unknown>) {
  return expect(
    Effect.runPromise(program.pipe(Effect.flip))
  ).resolves.toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
}

describe("contentRelease/receipt", () => {
  it("binds every publication counter to the signed manifest", async () => {
    const { release, signed } = await fixture();
    const verified = verifiedRelease(release);

    await expect(
      Effect.runPromise(publicationReceipt(verified, signed))
    ).resolves.toMatchObject({
      activatedHeads: 1,
      deletedHeads: 0,
      stagedArtifacts: 1,
      stagedItems: 1,
      stagedProjections: 1,
      stagedRoutes: 1,
    });

    const corruptions: readonly Doc<"contentReleases">[] = [
      { ...verified, releaseId: "release-other" },
      { ...verified, stagedArtifacts: 0 },
      { ...verified, stagedDeletes: 1 },
      { ...verified, stagedItems: 0 },
      { ...verified, stagedProjections: 0 },
      { ...verified, stagedRoutes: 0 },
      { ...verified, stagedUpserts: 0 },
    ];
    for (const corrupted of corruptions) {
      await expectIntegrity(publicationReceipt(corrupted, signed));
    }
  });

  it("rejects impossible staged counters and terminal evidence", async () => {
    const { release, signed } = await fixture();
    await expect(
      Effect.runPromise(stagedEvidence(release, signed))
    ).resolves.toBeUndefined();

    const invalid: readonly Doc<"contentReleases">[] = [
      { ...release, stagedArtifacts: -1 },
      { ...release, stagedDeletes: -1 },
      { ...release, stagedItems: -1 },
      { ...release, stagedProjections: -1 },
      { ...release, stagedRoutes: -1 },
      { ...release, stagedUpserts: -1 },
      { ...release, status: "completed" },
      { ...release, checkedIndex: 0 },
      { ...release, checkedItems: 1 },
      { ...release, proofAt: 1 },
      { ...release, proofJson: "{}" },
      { ...release, verifiedAt: 1 },
      { ...release, checkedItems: 0.5 },
      { ...release, checkedItems: -1 },
      { ...release, checkedIndex: 1 },
      { ...release, stagedItems: 2, stagedUpserts: 2 },
      { ...release, stagedItems: 1 },
      { ...release, stagedDeletes: 1, stagedItems: 1 },
      { ...release, stagedItems: 1, stagedUpserts: 2 },
      { ...release, stagedArtifacts: 1 },
      { ...release, stagedProjections: 1 },
      { ...release, completedAt: 1 },
      { ...release, receiptJson: "{}" },
    ];
    for (const corrupted of invalid) {
      await expectIntegrity(stagedEvidence(corrupted, signed));
    }
  });

  it("requires complete verifier evidence before activation", async () => {
    const { release, signed } = await fixture();
    const verified = verifiedRelease(release);
    await expect(
      Effect.runPromise(stagedEvidence(verified, signed))
    ).resolves.toBeUndefined();

    const corruptions: readonly Doc<"contentReleases">[] = [
      { ...verified, proofAt: undefined },
      { ...verified, proofJson: undefined },
      { ...verified, verifiedAt: undefined },
      { ...verified, checkedIndex: -1 },
    ];
    for (const corrupted of corruptions) {
      await expectIntegrity(stagedEvidence(corrupted, signed));
    }
  });

  it("validates every completed release marker and exact receipt", async () => {
    const { release, signed } = await fixture();
    const verified = verifiedRelease(release);
    const completed = {
      ...verified,
      completedAt: 2,
      receiptJson: JSON.stringify(makePublicationReceipt(verified, signed)),
      status: "completed",
    } satisfies Doc<"contentReleases">;

    await expect(
      Effect.runPromise(completedReceipt(completed, signed))
    ).resolves.toMatchObject({ releaseId: release.releaseId });

    const corruptions: readonly Doc<"contentReleases">[] = [
      { ...completed, status: "verified" },
      { ...completed, completedAt: undefined },
      { ...completed, proofAt: undefined },
      { ...completed, proofJson: undefined },
      { ...completed, verifiedAt: undefined },
      { ...completed, checkedItems: 0 },
      { ...completed, checkedIndex: -1 },
      { ...completed, receiptJson: undefined },
      { ...completed, receiptJson: "{}" },
    ];
    for (const corrupted of corruptions) {
      await expectIntegrity(completedReceipt(corrupted, signed));
    }
  });
});
