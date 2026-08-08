import {
  type ProtectedContentRuntimeRequest,
  ProtectedContentRuntimeRequestSchema,
  type ProtectedContentRuntimeSelector,
} from "@nakafa/aksara-contracts/runtime/protected/spec";
import type { TryoutPlacement } from "@nakafa/aksara-contracts/tryout/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import {
  decodeArtifactJson,
  decodeReleaseJson,
  decodeRendererJson,
} from "@repo/backend/convex/contentRelease/parse";
import { hasRendererIdentity } from "@repo/backend/convex/contentRelease/renderer";
import { loadVerifiedSnapshot } from "@repo/backend/convex/contentRelease/runtime/snapshot";
import { localeValidator } from "@repo/backend/convex/contentRelease/spec";
import { verifyTryoutPlacement } from "@repo/backend/convex/contentRelease/tryout/verify";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { findTryoutBundleByRelease } from "@repo/backend/convex/tryouts/runtime/bundle";
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
  locale: localeValidator,
  selectors: v.array(protectedSelectorValidator),
  snapshotReleaseId: v.string(),
  snapshotId: v.string(),
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
    snapshotManifestHash: v.string(),
    snapshotReleaseId: v.string(),
    snapshotId: v.string(),
  })
);

/** Stored protected batch returned only through one internal query. */
export type ProtectedRuntimeBatchRow = Infer<typeof protectedResultValidator>;

interface ProtectedBodyIdentity {
  readonly artifactHash: string;
  readonly contentKey: string;
  readonly kind: "answer" | "question";
}

interface ProtectedPlacementSelection {
  readonly placement: Doc<"tryoutPlacements">;
  readonly selector: ProtectedContentRuntimeSelector;
}

/** Selects the placement index owned by one protected body class. */
const loadPlacement = Effect.fn("contentRelease.loadProtectedPlacement")(
  function* (
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
  }
);

/** Derives the exact signed identity owned by one placement body. */
function bodyIdentity(
  placement: TryoutPlacement,
  delivery: ProtectedContentRuntimeSelector["delivery"]
): ProtectedBodyIdentity {
  if (delivery === "authenticated") {
    return {
      artifactHash: placement.questionArtifactHash,
      contentKey: placement.questionContentKey,
      kind: "question",
    };
  }
  return {
    artifactHash: placement.answerArtifactHash,
    contentKey: placement.answerContentKey,
    kind: "answer",
  };
}

/** Loads one immutable artifact after exact retained-snapshot membership checks. */
const resolveProtectedItem = Effect.fn("contentRelease.resolveProtectedItem")(
  function* (
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
    const sourcePath = `${placement.questionSourcePath}/${body.kind}.${request.locale}.mdx`;
    if (
      placement.locale !== request.locale ||
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
      artifact.payload.locale !== request.locale ||
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
  }
);

/** Loads and verifies the immutable release bundle selected by one attempt. */
const loadBundle = Effect.fn("contentRelease.loadProtectedBundle")(function* (
  ctx: QueryCtx,
  request: ProtectedContentRuntimeRequest
) {
  const stored = yield* findTryoutBundleByRelease(
    ctx,
    request.snapshotReleaseId
  ).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Protected try-out bundle ${request.snapshotReleaseId} could not be read.`,
        })
    )
  );
  if (!stored) {
    return null;
  }
  const [release, renderer] = yield* Effect.all([
    decodeReleaseJson(stored.releaseJson),
    decodeRendererJson(stored.rendererJson),
  ]);
  const snapshot = release.manifest.snapshots.tryout;
  if (
    stored.manifestHash !== release.manifestHash ||
    stored.releaseId !== release.manifest.releaseId ||
    stored.snapshotId !== request.snapshotId ||
    snapshot.resultSnapshotId !== request.snapshotId ||
    !hasRendererIdentity(release.manifest, renderer)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Protected try-out bundle ${request.snapshotReleaseId} changed its identity.`
    );
  }
  return stored;
});

/** Decodes and resolves one complete protected batch in a single transaction. */
const readProtectedProgram = Effect.fn("contentRelease.readProtectedBatch")(
  function* (ctx: QueryCtx, input: unknown) {
    const request = yield* Schema.decodeUnknown(
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
    const bundle = yield* loadBundle(ctx, request);
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
      snapshotManifestHash: bundle.manifestHash,
      snapshotReleaseId: bundle.releaseId,
      snapshotId: request.snapshotId,
    };
  }
);

/** Returns one ordered protected batch from a retained snapshot transaction. */
export const read = internalQuery({
  args: protectedArgsValidator,
  returns: protectedResultValidator,
  handler: (ctx, args) => runConvexProgram(readProtectedProgram(ctx, args)),
});
