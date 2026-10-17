import { assert } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import {
  ContentReleaseManifestSchema,
  PublicationReceiptSchema,
  SignedContentReleaseSchema,
} from "@nakafa/aksara-contracts/release";
import { RendererManifestEnvelopeSchema } from "@nakafa/aksara-contracts/renderer/contract";
import contentReleases from "@repo/backend/confect/_generated/tables/contentReleases";
import { releaseReachability } from "@repo/backend/confect/contentRelease/reachability";
import { makePublicationReceipt } from "@repo/backend/confect/contentRelease/receipt";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import {
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedEmptyRelease,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import { insertSignedCandidate } from "@repo/backend/test/content/stage";
import { convexTest } from "convex-test";
import { Effect, Schema, Struct } from "effect";

const encodeReceiptJson = Schema.encodeSync(
  Schema.fromJsonString(PublicationReceiptSchema)
);
export const encodeRendererJson = Schema.encodeSync(
  Schema.fromJsonString(RendererManifestEnvelopeSchema)
);
export const encodeReleaseJson = Schema.encodeSync(
  Schema.fromJsonString(SignedContentReleaseSchema)
);

/** Stages a signed catalog base and its pending release for one role, in one fresh Convex test. */
export const insertBaseFixture = Effect.fn("test.contentRelease.catalogBase")(
  function* (role: "candidate" | "recovery") {
    const t = convexTest(schema, convexModules);
    const baseSigned = yield* testSignedEmptyRelease(
      ReleaseIdSchema.make("catalog-base")
    );
    const releaseId = ReleaseIdSchema.make(`catalog-${role}`);
    const empty = yield* testEmptyManifest(releaseId);
    const signed = yield* testSignedRelease(
      ContentReleaseManifestSchema.make({
        ...empty,
        baseActiveAppLocales: baseSigned.manifest.activeAppLocales,
        baseManifestHash: baseSigned.manifestHash,
        baseReleaseId: baseSigned.manifest.releaseId,
        origin:
          role === "candidate"
            ? empty.origin
            : { kind: "rollback", releaseId: baseSigned.manifest.releaseId },
      })
    );
    return yield* Effect.promise(async () => {
      const ids = await t.mutation(async (ctx) => {
        await insertSignedCandidate(
          ctx,
          baseSigned.manifest.releaseId,
          baseSigned,
          encodeRendererJson(TEST_PROOF_RENDERER)
        );
        const base = await ctx.db.query("contentReleases").unique();
        const state = await ctx.db.query("contentState").unique();
        assert(base && state, "Expected a signed catalog base.");
        await ctx.db.patch("contentReleases", base._id, {
          proofAt: 1,
          proofJson: "{}",
          verifiedAt: 1,
          ...(role === "candidate"
            ? {
                completedAt: 1,
                // makePublicationReceipt copies activeAppLocales into a plain
                // array, which the contract types as a non-empty locale list. The
                // receipt is decoded into that contract type before it is encoded.
                receiptJson: encodeReceiptJson(
                  Schema.decodeUnknownSync(PublicationReceiptSchema)(
                    makePublicationReceipt(
                      Schema.decodeSync(contentReleases.Doc)(base),
                      baseSigned
                    )
                  )
                ),
                status: "completed" as const,
              }
            : { status: "verified" as const }),
        });
        const pendingId = await ctx.db.insert("contentReleases", {
          ...Struct.omit(base, ["_id", "_creationTime"]),
          ...releaseReachability(signed),
          releaseId,
          releaseJson: encodeReleaseJson(signed),
          role,
          sequence: 2,
          status: "verifying",
        });
        await ctx.db.patch("contentState", state._id, {
          nextSequence: 3,
          ...(role === "candidate"
            ? {
                activeManifestHash: baseSigned.manifestHash,
                activeReleaseId: base.releaseId,
                activeSequence: 1,
                candidateManifestHash: signed.manifestHash,
                candidateReleaseId: releaseId,
                candidateSequence: 2,
              }
            : {
                recoveryManifestHash: signed.manifestHash,
                recoveryReleaseId: releaseId,
                recoverySequence: 2,
              }),
        });
        return { baseId: base._id, pendingId, stateId: state._id };
      });
      return { ...ids, baseSigned, releaseId, t };
    });
  }
);
