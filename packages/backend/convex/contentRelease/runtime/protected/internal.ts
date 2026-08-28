import {
  type ProtectedContentRuntimeRequest,
  ProtectedContentRuntimeRequestSchema,
  type ProtectedContentRuntimeSelector,
} from "@nakafa/aksara-contracts/runtime/protected/spec";
import type { TryoutPlacement } from "@nakafa/aksara-contracts/tryout/placement";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import {
  decodeArtifactJson,
  decodeRendererJson,
  decodeTryoutRuntimeBundleJson,
} from "@repo/backend/convex/contentRelease/parse";
import { loadVerifiedSnapshot } from "@repo/backend/convex/contentRelease/runtime/snapshot";
import { verifyTryoutPlacement } from "@repo/backend/convex/contentRelease/tryout/verify";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { findTryoutRuntimeBundleByHash } from "@repo/backend/convex/tryouts/runtime/signed";
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
  bundleHash: v.string(),
  selectors: v.array(protectedSelectorValidator),
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
    bundleJson: v.string(),
    items: v.array(protectedItemValidator),
    rendererJson: v.string(),
  })
);

/** Stored protected batch returned only through one internal query. */
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

/** Selects one retained placement through its exact body artifact identity. */
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
    const sourcePath = `${placement.questionSourcePath}/${body.kind}.${body.artifactLocale}.mdx`;
    if (
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
  }
);

/** Loads and checks the permanent bundle selected by one attempt. */
const loadBundle = Effect.fn("contentRelease.loadProtectedBundle")(function* (
  ctx: QueryCtx,
  request: ProtectedContentRuntimeRequest
) {
  const stored = yield* findTryoutRuntimeBundleByHash(
    ctx,
    request.bundleHash
  ).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Protected try-out bundle ${request.bundleHash} could not be read.`,
        })
    )
  );
  if (!stored) {
    return null;
  }
  const [bundle, renderer] = yield* Effect.all([
    decodeTryoutRuntimeBundleJson(stored.bundleJson),
    decodeRendererJson(stored.rendererJson),
  ]);
  if (
    stored.bundleHash !== bundle.bundleHash ||
    stored.bundleHash !== request.bundleHash ||
    stored.snapshotId !== bundle.payload.snapshot.snapshotId ||
    stored.snapshotId !== request.snapshotId ||
    stored.rendererManifestHash !== bundle.payload.rendererManifestHash ||
    stored.rendererManifestHash !== renderer.hash ||
    stored.sourceGitSha !== bundle.payload.sourceGitSha ||
    stored.sourceManifestHash !== bundle.payload.sourceManifestHash ||
    stored.sourceReleaseId !== bundle.payload.sourceReleaseId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Protected try-out bundle ${request.bundleHash} changed its identity.`
    );
  }
  return stored;
});

/** Decodes and resolves one complete protected batch in a single transaction. */
const readProtectedProgram = Effect.fn("contentRelease.readProtectedBatch")(
  function* (ctx: QueryCtx, input: unknown) {
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
    const bundle = yield* loadBundle(ctx, request);
    if (!bundle) {
      return null;
    }
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
    const items = yield* Effect.forEach(
      foundSelections,
      ({ placement, selector }) =>
        resolveProtectedItem(ctx, request, selector, placement),
      { concurrency: "unbounded" }
    );
    return {
      bundleJson: bundle.bundleJson,
      items,
      rendererJson: bundle.rendererJson,
    };
  }
);

/** Returns one ordered protected batch from a permanent runtime bundle. */
export const read = internalQuery({
  args: protectedArgsValidator,
  returns: protectedResultValidator,
  handler: (ctx, args) => runConvexProgram(readProtectedProgram(ctx, args)),
});
