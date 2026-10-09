import { assert, describe, expect, it } from "@effect/vitest";
import { PublicationReceiptSchema } from "@nakafa/aksara-contracts/release";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import contentReleases from "@repo/backend/confect/_generated/tables/contentReleases";
import { decodeReleaseJson } from "@repo/backend/confect/contentRelease/parse";
import {
  completedAnchor,
  completedReceipt,
  makePublicationReceipt,
  publicationReceipt,
  stagedEvidence,
} from "@repo/backend/confect/contentRelease/receipt";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import { insertTestRelease } from "@repo/backend/test/content/stage";
import { TEST_PROOF_WORKFLOW_ID } from "@repo/backend/test/content/verify";
import { convexTest } from "convex-test";
import { Effect, Result, Schema, Struct } from "effect";

const ReceiptJsonSchema = Schema.fromJsonString(PublicationReceiptSchema);
const encodeReceiptJson = Schema.encodeUnknownSync(ReceiptJsonSchema);

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
    return {
      release: yield* Schema.decodeEffect(contentReleases.Doc)(release),
      signed,
    };
  });
}

/** Creates a fully staged and verified one-item release row. */
function verifiedRelease(release: Docs["contentReleases"]) {
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
  } satisfies Docs["contentReleases"];
}

/** Asserts that one durable evidence program fails closed. */
function expectIntegrity<A, E>(program: Effect.Effect<A, E>) {
  return Effect.gen(function* () {
    const result = yield* Effect.result(program);
    assert(Result.isFailure(result));
    expect(result.failure).toMatchObject({
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

      const corruptions: readonly Docs["contentReleases"][] = [
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

      const invalid: readonly Docs["contentReleases"][] = [
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

      const corruptions: readonly Docs["contentReleases"][] = [
        Struct.omit(verified, ["proofAt"]),
        { ...verified, proofFailure: "failed" },
        Struct.omit(verified, ["proofJson"]),
        Struct.omit(verified, ["verifiedAt"]),
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
        receiptJson: encodeReceiptJson(
          makePublicationReceipt(verified, signed)
        ),
        status: "completed",
      } satisfies Docs["contentReleases"];

      expect(yield* completedReceipt(completed, signed)).toMatchObject({
        releaseId: release.releaseId,
      });

      const corruptions: readonly Docs["contentReleases"][] = [
        { ...completed, status: "verified" },
        Struct.omit(completed, ["completedAt"]),
        Struct.omit(completed, ["proofAt"]),
        { ...completed, proofFailure: "failed" },
        Struct.omit(completed, ["proofJson"]),
        Struct.omit(completed, ["verifiedAt"]),
        { ...completed, checkedItems: 0 },
        { ...completed, checkedIndex: -1 },
        Struct.omit(completed, ["receiptJson"]),
        { ...completed, receiptJson: "{}" },
        {
          ...completed,
          receiptJson: encodeReceiptJson({
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

  it.live("proves one completed anchor from stored facts alone", () =>
    Effect.gen(function* () {
      const { release, signed } = yield* fixture();
      const verified = verifiedRelease(release);
      const completed = {
        ...verified,
        completedAt: 2,
        receiptJson: encodeReceiptJson(
          makePublicationReceipt(verified, signed)
        ),
        status: "completed",
      } satisfies Docs["contentReleases"];

      expect(yield* completedAnchor(completed)).toBeUndefined();

      const corruptions: readonly Docs["contentReleases"][] = [
        { ...completed, status: "verified" },
        Struct.omit(completed, ["completedAt"]),
        Struct.omit(completed, ["proofAt"]),
        { ...completed, proofFailure: "failed" },
        Struct.omit(completed, ["proofJson"]),
        { ...completed, proofWorkflowId: TEST_PROOF_WORKFLOW_ID },
        Struct.omit(completed, ["verifiedAt"]),
        Struct.omit(completed, ["receiptJson"]),
        { ...completed, stagedArtifacts: -1 },
        { ...completed, checkedItems: 2, checkedIndex: 1 },
        { ...completed, checkedIndex: -1 },
      ];
      for (const corrupted of corruptions) {
        yield* expectIntegrity(completedAnchor(corrupted));
      }
    })
  );
});
