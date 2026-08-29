import type { RendererManifestEnvelope } from "@nakafa/aksara-contracts/renderer/contract";
import type { SignedTryoutRuntimeBundle } from "@nakafa/aksara-contracts/tryout/runtime/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { verifyFinalizationPlacements } from "@repo/backend/convex/contentRelease/finalize/proof";
import {
  FINALIZATION_ATTEMPT_SET_DOMAIN,
  type FinalizationAttemptSpec,
  type FinalizationContract,
  type FinalizationReceipt,
  finalizationContract,
} from "@repo/backend/convex/contentRelease/finalize/spec";
import {
  decodeRendererJson,
  decodeTryoutRuntimeBundleJson,
} from "@repo/backend/convex/contentRelease/parse";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  findTryoutRuntimeBundleByHash,
  storeAuthenticatedTryoutRuntimeBundle,
} from "@repo/backend/convex/tryouts/runtime/signed";
import { v } from "convex/values";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;

export const finalizationReceiptValidator = v.object({
  backfilledAttempts: v.number(),
  bundleCreated: v.union(v.literal(0), v.literal(1)),
  permanentAttempts: v.number(),
  placementCount: v.number(),
});

/** Checks whether one stored attempt belongs to one exact recovered class. */
function matchesAttempt(attempt: TryoutAttempt, spec: FinalizationAttemptSpec) {
  return (
    attempt.appLocale === spec.appLocale &&
    attempt.snapshotReleaseId === spec.snapshotReleaseId &&
    attempt.totalQuestions === spec.totalQuestions &&
    attempt.tryoutSnapshotId === spec.snapshotId
  );
}

/** Classifies paired permanent ownership without accepting partial state. */
const readPermanentState = Effect.fn(
  "contentRelease.finalize.readPermanentState"
)(function* (attempt: TryoutAttempt) {
  const hasId = attempt.tryoutBundleId !== undefined;
  const hasHash = attempt.tryoutBundleHash !== undefined;
  if (hasId !== hasHash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Terminal try-out expansion found partial runtime ownership."
    );
  }
  return hasId && hasHash;
});

/** Requires the exact signed genesis payload and its existing renderer bytes. */
const requireGenesisIdentity = Effect.fn(
  "contentRelease.finalize.requireGenesisIdentity"
)(function* (
  bundle: SignedTryoutRuntimeBundle,
  renderer: RendererManifestEnvelope,
  contract: FinalizationContract
) {
  const identity = contract.genesisIdentity;
  if (
    bundle.bundleHash !== contract.genesisBundleHash ||
    bundle.payload.rendererManifestHash !== identity.rendererManifestHash ||
    bundle.payload.snapshot.snapshotId !== identity.snapshotId ||
    bundle.payload.sourceGitSha !== identity.sourceGitSha ||
    bundle.payload.sourceManifestHash !== identity.sourceManifestHash ||
    bundle.payload.sourceReleaseId !== identity.sourceReleaseId ||
    renderer.hash !== identity.rendererManifestHash
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Genesis runtime bytes differ from the reviewed production source."
    );
  }
});

/** Selects each recovered attempt class exactly once from a bounded inventory. */
const selectAttempts = Effect.fn("contentRelease.finalize.selectAttempts")(
  function* (
    attempts: readonly TryoutAttempt[],
    contract: FinalizationContract
  ) {
    const rows = yield* Effect.forEach(contract.attempts, (spec) => {
      const matches = attempts.filter((attempt) =>
        matchesAttempt(attempt, spec)
      );
      const attempt = matches[0];
      return matches.length === 1 && attempt
        ? Effect.succeed({ attempt, spec })
        : releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            "Terminal try-out expansion lost one exact attempt class."
          );
    });
    const ids = rows.map(({ attempt }) => attempt._id).sort();
    const digest = yield* hashText(
      "terminal try-out attempt set",
      `${FINALIZATION_ATTEMPT_SET_DOMAIN}\n${JSON.stringify(ids)}`
    );
    if (
      new Set(ids).size !== contract.attempts.length ||
      digest !== contract.attemptSetHash
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Terminal try-out expansion selected different attempt identities."
      );
    }
    return rows;
  }
);

/** Atomically expands the exact four terminal attempts to permanent bundles. */
export const backfillRuntimeAttempts = Effect.fn(
  "contentRelease.finalize.backfillRuntimeAttempts"
)(function* (
  ctx: MutationCtx,
  bundle: SignedTryoutRuntimeBundle,
  renderer: RendererManifestEnvelope,
  contract: FinalizationContract = finalizationContract
) {
  yield* requireGenesisIdentity(bundle, renderer, contract);
  const attempts = yield* Effect.promise(() =>
    ctx.db.query("tryoutAttempts").take(contract.attemptLimit + 1)
  );
  if (attempts.length > contract.attemptLimit) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Terminal try-out expansion exceeded its bounded attempt inventory."
    );
  }
  const selected = yield* selectAttempts(attempts, contract);
  const selectedIds = new Set(selected.map(({ attempt }) => attempt._id));
  for (const attempt of attempts) {
    const permanent = yield* readPermanentState(attempt);
    if (!(permanent || selectedIds.has(attempt._id))) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Terminal try-out expansion found an unexpected predecessor attempt."
      );
    }
  }
  const storedGenesis = yield* storeAuthenticatedTryoutRuntimeBundle(
    ctx,
    bundle,
    renderer
  );
  if (storedGenesis.bundleHash !== contract.genesisBundleHash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Genesis runtime storage returned a different content address."
    );
  }
  let backfilledAttempts = 0;
  let placementCount = 0;
  for (const { attempt, spec } of selected) {
    if (
      attempt.status === "in-progress" ||
      attempt.completedAt === null ||
      attempt.endReason === null
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        "Terminal try-out expansion selected a non-terminal attempt."
      );
    }
    const target = yield* findTryoutRuntimeBundleByHash(
      ctx,
      spec.targetBundleHash
    );
    if (!target || target.snapshotId !== spec.snapshotId) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Terminal try-out expansion lost its permanent target bundle."
      );
    }
    const placements = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutAttemptPlacements")
        .withIndex("by_tryoutAttemptId_and_questionOrder", (query) =>
          query.eq("tryoutAttemptId", attempt._id)
        )
        .take(spec.totalQuestions + 1)
    );
    placementCount += yield* verifyFinalizationPlacements(placements, spec);
    const permanent = yield* readPermanentState(attempt);
    if (permanent) {
      if (
        attempt.tryoutBundleId !== target._id ||
        attempt.tryoutBundleHash !== target.bundleHash
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          "Terminal try-out expansion found changed permanent ownership."
        );
      }
      continue;
    }
    yield* Effect.promise(() =>
      ctx.db.patch("tryoutAttempts", attempt._id, {
        tryoutBundleHash: target.bundleHash,
        tryoutBundleId: target._id,
      })
    );
    backfilledAttempts += 1;
  }
  return {
    backfilledAttempts,
    bundleCreated: storedGenesis.created,
    permanentAttempts: attempts.length,
    placementCount,
  } satisfies FinalizationReceipt;
});

/** Internal transaction called only after Node verifies the signed asset. */
export const backfill = internalMutation({
  args: { bundleJson: v.string(), rendererJson: v.string() },
  returns: finalizationReceiptValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        const [bundle, renderer] = yield* Effect.all([
          decodeTryoutRuntimeBundleJson(args.bundleJson),
          decodeRendererJson(args.rendererJson),
        ]);
        return yield* backfillRuntimeAttempts(ctx, bundle, renderer);
      })
    ),
});
