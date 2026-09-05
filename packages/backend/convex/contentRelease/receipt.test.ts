import { describe, expect, it } from "@effect/vitest";
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
import { insertTestRelease } from "@repo/backend/test/content/stage";
import { convexTest } from "convex-test";
import { Effect } from "effect";

/** Loads one typed release row and its decoded immutable manifest. */
function fixture() {
  return Effect.gen(function* () {
    const t = convexTest(schema, convexModules);
    yield* Effect.promise(() => t.mutation((ctx) => insertTestRelease(ctx)));
    const release = yield* Effect.promise(() =>
      t.run((ctx) => ctx.db.query("contentReleases").unique())
    );
    if (!release) {
      return yield* Effect.die(new Error("Expected receipt release fixture."));
    }
    const signed = yield* decodeReleaseJson(release.releaseJson);
    return { release, signed };
  });
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
  return Effect.gen(function* () {
    expect(yield* program.pipe(Effect.flip)).toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
    });
  });
}

describe("contentRelease/receipt", () => {
  it.live("binds every publication counter to the signed manifest", () =>
    Effect.gen(function* () {
      const { release, signed } = yield* fixture();
      const verified = verifiedRelease(release);

      expect(yield* publicationReceipt(verified, signed)).toMatchObject({
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
        yield* expectIntegrity(publicationReceipt(corrupted, signed));
      }
    })
  );

  it.live("rejects impossible staged counters and terminal evidence", () =>
    Effect.gen(function* () {
      const { release, signed } = yield* fixture();
      expect(yield* stagedEvidence(release, signed)).toBeUndefined();

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
        { ...release, proofFailure: "failed" },
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
        { ...release, status: "verifying", verifiedAt: 1 },
        {
          ...release,
          status: "verifying",
          proofAt: 1,
          proofJson: "{}",
          proofFailure: "failed",
        },
      ];
      for (const corrupted of invalid) {
        yield* expectIntegrity(stagedEvidence(corrupted, signed));
      }
      expect(
        yield* stagedEvidence(
          { ...release, proofFailure: "failed", status: "verifying" },
          signed
        )
      ).toBeUndefined();
      expect(
        yield* stagedEvidence({ ...release, status: "verifying" }, signed)
      ).toBeUndefined();
    })
  );

  it.live("requires complete verifier evidence before activation", () =>
    Effect.gen(function* () {
      const { release, signed } = yield* fixture();
      const verified = verifiedRelease(release);
      expect(yield* stagedEvidence(verified, signed)).toBeUndefined();

      const corruptions: readonly Doc<"contentReleases">[] = [
        { ...verified, proofAt: undefined },
        { ...verified, proofFailure: "failed" },
        { ...verified, proofJson: undefined },
        { ...verified, verifiedAt: undefined },
        { ...verified, checkedIndex: -1 },
      ];
      for (const corrupted of corruptions) {
        yield* expectIntegrity(stagedEvidence(corrupted, signed));
      }
    })
  );

  it.live("validates every completed release marker and exact receipt", () =>
    Effect.gen(function* () {
      const { release, signed } = yield* fixture();
      const verified = verifiedRelease(release);
      const completed = {
        ...verified,
        completedAt: 2,
        receiptJson: JSON.stringify(makePublicationReceipt(verified, signed)),
        status: "completed",
      } satisfies Doc<"contentReleases">;

      expect(yield* completedReceipt(completed, signed)).toMatchObject({
        releaseId: release.releaseId,
      });

      const corruptions: readonly Doc<"contentReleases">[] = [
        { ...completed, status: "verified" },
        { ...completed, completedAt: undefined },
        { ...completed, proofAt: undefined },
        { ...completed, proofFailure: "failed" },
        { ...completed, proofJson: undefined },
        { ...completed, verifiedAt: undefined },
        { ...completed, checkedItems: 0 },
        { ...completed, checkedIndex: -1 },
        { ...completed, receiptJson: undefined },
        { ...completed, receiptJson: "{}" },
        {
          ...completed,
          receiptJson: JSON.stringify({
            ...makePublicationReceipt(verified, signed),
            releaseId: "another-release",
          }),
        },
      ];
      for (const corrupted of corruptions) {
        yield* expectIntegrity(completedReceipt(corrupted, signed));
      }
    })
  );
});
