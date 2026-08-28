import {
  type ProtectedContentRuntimeRequest,
  ProtectedContentRuntimeRequestSchema,
  type ProtectedContentRuntimeSelector,
} from "@nakafa/aksara-contracts/runtime/predecessor/spec";
import type { TryoutPlacement } from "@nakafa/aksara-contracts/tryout/placement";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { decodeArtifactJson } from "@repo/backend/convex/contentRelease/parse";
import { loadPredecessorBundle } from "@repo/backend/convex/contentRelease/runtime/predecessor/bundle";
import { loadVerifiedSnapshot } from "@repo/backend/convex/contentRelease/runtime/snapshot";
import { appLocaleValidator } from "@repo/backend/convex/contentRelease/spec";
import { verifyTryoutPlacement } from "@repo/backend/convex/contentRelease/tryout/verify";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { Effect, Schema } from "effect";

const protectedDeliveryValidator = v.union(
  v.literal("authenticated"),
  v.literal("entitled")
);
const protectedSelectorValidator = v.object({
  artifactHash: v.string(),
  contentKey: v.string(),
  delivery: protectedDeliveryValidator,
});
const protectedArgsValidator = {
  appLocale: appLocaleValidator,
  selectors: v.array(protectedSelectorValidator),
  snapshotId: v.string(),
  snapshotReleaseId: v.string(),
};
const protectedItemValidator = v.object({
  artifactJson: v.string(),
  delivery: protectedDeliveryValidator,
  sourcePath: v.string(),
});
const protectedResultValidator = v.union(
  v.null(),
  v.object({
    items: v.array(protectedItemValidator),
    releaseJson: v.string(),
    rendererJson: v.string(),
    snapshotId: v.string(),
    snapshotManifestHash: v.string(),
    snapshotReleaseId: v.string(),
  })
);

/** Stored predecessor batch returned only through one internal query. */
export type ProtectedRuntimeBatchRow = Infer<typeof protectedResultValidator>;

interface ProtectedBodyIdentity {
  readonly artifactHash: string;
  readonly artifactLocale: TryoutPlacement["answerArtifactLocale"];
  readonly contentKey: string;
  readonly kind: "answer" | "question";
}

interface ProtectedPlacementSelection {
  readonly placement: Doc<"tryoutPlacements">;
  readonly selector: ProtectedContentRuntimeSelector;
}

/** Selects the placement index owned by one predecessor body class. */
const loadPlacement = Effect.fn(
  "contentRelease.loadPredecessorProtectedPlacement"
)(function* (
  ctx: QueryCtx,
  request: ProtectedContentRuntimeRequest,
  selector: ProtectedContentRuntimeSelector
) {
  if (selector.delivery === "authenticated") {
    return yield* Effect.promise(() =>
      ctx.db
        .query("tryoutPlacements")
        .withIndex("by_snapshotId_and_questionArtifactHash", (index) =>
          index
            .eq("snapshotId", request.snapshotId)
            .eq("questionArtifactHash", selector.artifactHash)
        )
        .first()
    );
  }
  return yield* Effect.promise(() =>
    ctx.db
      .query("tryoutPlacements")
      .withIndex("by_snapshotId_and_answerArtifactHash", (index) =>
        index
          .eq("snapshotId", request.snapshotId)
          .eq("answerArtifactHash", selector.artifactHash)
      )
      .first()
  );
});

/** Derives the exact signed identity owned by one placement body. */
function bodyIdentity(
  placement: TryoutPlacement,
  delivery: ProtectedContentRuntimeSelector["delivery"]
): ProtectedBodyIdentity {
  if (delivery === "authenticated") {
    return {
      artifactHash: placement.questionArtifactHash,
      artifactLocale: placement.questionArtifactLocale,
      contentKey: placement.questionContentKey,
      kind: "question",
    };
  }
  return {
    artifactHash: placement.answerArtifactHash,
    artifactLocale: placement.answerArtifactLocale,
    contentKey: placement.answerContentKey,
    kind: "answer",
  };
}

/** Loads one immutable artifact after predecessor membership checks. */
const resolveProtectedItem = Effect.fn(
  "contentRelease.resolvePredecessorProtectedItem"
)(function* (
  ctx: QueryCtx,
  request: ProtectedContentRuntimeRequest,
  selector: ProtectedContentRuntimeSelector,
  storedPlacement: Doc<"tryoutPlacements">
) {
  const placement = yield* verifyTryoutPlacement(
    storedPlacement,
    request.snapshotId
  );
  const body = bodyIdentity(placement, selector.delivery);
  const sourcePath = `${placement.questionSourcePath}/${body.kind}.${body.artifactLocale}.mdx`;
  if (
    placement.appLocale !== request.appLocale ||
    body.artifactHash !== selector.artifactHash ||
    body.contentKey !== selector.contentKey
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Protected try-out body ${selector.contentKey} changed its snapshot identity.`
    );
  }
  const storedArtifact = yield* Effect.promise(() =>
    ctx.db
      .query("contentArtifacts")
      .withIndex("by_artifactHash", (index) =>
        index.eq("artifactHash", selector.artifactHash)
      )
      .unique()
  );
  if (!storedArtifact) {
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      `Protected try-out body ${selector.contentKey} lost its artifact.`
    );
  }
  const artifact = yield* decodeArtifactJson(storedArtifact.artifactJson);
  if (
    artifact.artifactHash !== selector.artifactHash ||
    artifact.payload.contentKey !== selector.contentKey ||
    artifact.payload.artifactLocale !== body.artifactLocale ||
    artifact.payload.rendererDomain !== placement.rendererDomain
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Protected try-out body ${selector.contentKey} has mismatched content.`
    );
  }
  return {
    artifactJson: storedArtifact.artifactJson,
    delivery: selector.delivery,
    sourcePath,
  };
});

/** Resolves one complete predecessor batch in a single transaction. */
const readProtectedProgram = Effect.fn(
  "contentRelease.readPredecessorProtectedBatch"
)(function* (ctx: QueryCtx, input: unknown) {
  const request = yield* Schema.decodeUnknownEffect(
    ProtectedContentRuntimeRequestSchema,
    { onExcessProperty: "error" }
  )(input).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: "Protected runtime request is invalid.",
        })
    )
  );
  const selections = yield* Effect.forEach(
    request.selectors,
    (selector) =>
      loadPlacement(ctx, request, selector).pipe(
        Effect.map((placement) => ({ placement, selector }))
      ),
    { concurrency: "unbounded" }
  );
  if (selections.some(({ placement }) => placement === null)) {
    return null;
  }
  const foundSelections = selections.filter(
    (selection): selection is ProtectedPlacementSelection =>
      selection.placement !== null
  );
  yield* loadVerifiedSnapshot(ctx, "tryout", request.snapshotId);
  const bundle = yield* loadPredecessorBundle(ctx, request);
  if (!bundle) {
    return null;
  }
  const items = yield* Effect.forEach(
    foundSelections,
    ({ placement, selector }) =>
      resolveProtectedItem(ctx, request, selector, placement),
    { concurrency: "unbounded" }
  );
  return {
    items,
    releaseJson: bundle.releaseJson,
    rendererJson: bundle.rendererJson,
    snapshotId: request.snapshotId,
    snapshotManifestHash: bundle.manifestHash,
    snapshotReleaseId: bundle.releaseId,
  };
});

/** Returns one ordered predecessor batch from a retained snapshot. */
export const read = internalQuery({
  args: protectedArgsValidator,
  returns: protectedResultValidator,
  handler: (ctx, args) => runConvexProgram(readProtectedProgram(ctx, args)),
});
