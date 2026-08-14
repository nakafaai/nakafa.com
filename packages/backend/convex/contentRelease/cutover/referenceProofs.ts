import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { requireCutoverPhase } from "@repo/backend/convex/contentRelease/cutover/state";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

export interface ReferenceProofCounts {
  readonly article: number;
  readonly material: number;
  readonly materialTopic: number;
  readonly quran: number;
  readonly tryout: number;
}

type ReadCtx = MutationCtx | QueryCtx;
type ReferenceFamily = keyof ReferenceProofCounts;
type ReferenceProofReceipt = NonNullable<
  Doc<"contentCutoverState">["articleReferenceProof"]
>;

/** Persists one isolated proof only after its exact inventory was accepted. */
export const persistReferenceProof = Effect.fn(
  "contentRelease.cutover.persistReferenceProof"
)(function* (
  ctx: MutationCtx,
  family: ReferenceFamily,
  count: number,
  expectedCount: number
) {
  const state = yield* requireCutoverPhase(ctx, ["quiescent"]);
  if (count !== expectedCount) {
    return yield* referenceProofFailure(
      `${family} proved ${count} rows instead of ${expectedCount}.`
    );
  }
  const receipt = { count, provedAt: Date.now() };
  yield* writeReceipt(ctx, state, family, receipt);
  return receipt;
});

/** Requires every durable proof and the original publication identity. */
export const requireReferenceProofs = Effect.fn(
  "contentRelease.cutover.requireReferenceProofs"
)(function* (ctx: ReadCtx, expected: ReferenceProofCounts) {
  const state = yield* requireCutoverPhase(ctx, ["quiescent"]);
  const states = yield* Effect.promise(() =>
    ctx.db.query("contentState").take(2)
  );
  const publication = states[0];
  if (
    states.length !== 1 ||
    publication?.activeReleaseId !== state.auditedActiveReleaseId ||
    publication.activeSequence !== state.auditedActiveSequence ||
    publication.nextSequence !== state.auditedNextSequence ||
    publication.candidateReleaseId !== undefined ||
    publication.recoveryReleaseId !== undefined
  ) {
    return yield* referenceProofFailure(
      "The audited publication identity changed after reference proofs."
    );
  }
  if (state.quranReferenceProgress !== undefined) {
    return yield* referenceProofFailure(
      "The Quran reference proof still has an active cursor."
    );
  }
  if (state.materialReferenceProgress !== undefined) {
    return yield* referenceProofFailure(
      "The material topic reference proof still has an active cursor."
    );
  }
  yield* Effect.all([
    requireReceipt(
      "article",
      state.articleReferenceProof,
      expected.article,
      state.auditedAt
    ),
    requireReceipt(
      "material",
      state.materialReferenceProof,
      expected.material,
      state.auditedAt
    ),
    requireReceipt(
      "material topic",
      state.materialTopicReferenceProof,
      expected.materialTopic,
      state.auditedAt
    ),
    requireReceipt(
      "Quran",
      state.quranReferenceProof,
      expected.quran,
      state.auditedAt
    ),
    requireReceipt(
      "try-out",
      state.tryoutReferenceProof,
      expected.tryout,
      state.auditedAt
    ),
  ]);
  return expected;
});

/** Validates one receipt without reopening its authenticated source rows. */
const requireReceipt = Effect.fn("contentRelease.cutover.requireProofReceipt")(
  function* (
    family: string,
    receipt: ReferenceProofReceipt | undefined,
    expectedCount: number,
    auditedAt: number
  ) {
    if (
      !receipt ||
      receipt.count !== expectedCount ||
      !Number.isSafeInteger(receipt.provedAt) ||
      receipt.provedAt < auditedAt
    ) {
      return yield* referenceProofFailure(
        `The ${family} reference proof is incomplete.`
      );
    }
  }
);

/** Writes the family-owned receipt without a dynamic schema patch. */
const writeReceipt = Effect.fn("contentRelease.cutover.writeProofReceipt")(
  function* (
    ctx: MutationCtx,
    state: Doc<"contentCutoverState">,
    family: ReferenceFamily,
    receipt: ReferenceProofReceipt
  ) {
    const updatedAt = receipt.provedAt;
    if (family === "article") {
      yield* Effect.promise(() =>
        ctx.db.patch("contentCutoverState", state._id, {
          articleReferenceProof: receipt,
          updatedAt,
        })
      );
      return;
    }
    if (family === "material") {
      yield* Effect.promise(() =>
        ctx.db.patch("contentCutoverState", state._id, {
          materialReferenceProof: receipt,
          updatedAt,
        })
      );
      return;
    }
    if (family === "materialTopic") {
      yield* Effect.promise(() =>
        ctx.db.patch("contentCutoverState", state._id, {
          materialTopicReferenceProof: receipt,
          updatedAt,
        })
      );
      return;
    }
    if (family === "quran") {
      yield* Effect.promise(() =>
        ctx.db.patch("contentCutoverState", state._id, {
          quranReferenceProof: receipt,
          updatedAt,
        })
      );
      return;
    }
    yield* Effect.promise(() =>
      ctx.db.patch("contentCutoverState", state._id, {
        tryoutReferenceProof: receipt,
        updatedAt,
      })
    );
  }
);

function referenceProofFailure(message: string) {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    `Reference reader cutover: ${message}`
  );
}
