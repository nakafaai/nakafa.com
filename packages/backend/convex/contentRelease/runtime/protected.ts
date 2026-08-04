import {
  type ProtectedContentRuntimeRequest,
  ProtectedContentRuntimeRequestSchema,
} from "@nakafa/aksara-contracts/runtime/spec";
import type { TryoutPlacement } from "@nakafa/aksara-contracts/tryout/spec";
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

const protectedArgsValidator = {
  artifactHash: v.string(),
  contentKey: v.string(),
  delivery: v.union(v.literal("authenticated"), v.literal("entitled")),
  locale: localeValidator,
  snapshotReleaseId: v.string(),
  snapshotId: v.string(),
};

const protectedResultValidator = v.union(
  v.null(),
  v.object({
    artifactJson: v.string(),
    delivery: protectedArgsValidator.delivery,
    releaseJson: v.string(),
    rendererJson: v.string(),
    snapshotManifestHash: v.string(),
    snapshotReleaseId: v.string(),
    snapshotId: v.string(),
    sourcePath: v.string(),
  })
);

/** Stored protected runtime row returned only through a retained snapshot. */
export type ProtectedRuntimeRow = Infer<typeof protectedResultValidator>;

interface ProtectedBodyIdentity {
  readonly artifactHash: string;
  readonly contentKey: string;
  readonly kind: "answer" | "question";
}

/** Selects the placement index owned by one protected body class. */
const loadPlacement = Effect.fn("contentRelease.loadProtectedPlacement")(
  function* (ctx: QueryCtx, request: ProtectedContentRuntimeRequest) {
    if (request.delivery === "authenticated") {
      return yield* Effect.promise(() =>
        ctx.db
          .query("tryoutPlacements")
          .withIndex("by_snapshotId_and_questionArtifactHash", (index) =>
            index
              .eq("snapshotId", request.snapshotId)
              .eq("questionArtifactHash", request.artifactHash)
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
            .eq("answerArtifactHash", request.artifactHash)
        )
        .first()
    );
  }
);

/** Derives the exact signed identity owned by one placement body. */
function bodyIdentity(
  placement: TryoutPlacement,
  delivery: ProtectedContentRuntimeRequest["delivery"]
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

/** Loads one immutable artifact after exact retained-snapshot authorization. */
const resolveProtected = Effect.fn("contentRelease.resolveProtected")(
  function* (ctx: QueryCtx, request: ProtectedContentRuntimeRequest) {
    const storedPlacement = yield* loadPlacement(ctx, request);
    if (!storedPlacement) {
      return null;
    }
    yield* loadVerifiedSnapshot(ctx, "tryout", request.snapshotId);
    const bundle = yield* loadBundle(ctx, request);
    const placement = yield* verifyTryoutPlacement(
      storedPlacement,
      request.snapshotId
    );
    const body = bodyIdentity(placement, request.delivery);
    const sourcePath = `${placement.questionSourcePath}/${body.kind}.${request.locale}.mdx`;
    if (
      placement.locale !== request.locale ||
      body.artifactHash !== request.artifactHash ||
      body.contentKey !== request.contentKey
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Protected try-out body ${request.contentKey} changed its snapshot identity.`
      );
    }
    const storedArtifact = yield* Effect.promise(() =>
      ctx.db
        .query("contentArtifacts")
        .withIndex("by_artifactHash", (index) =>
          index.eq("artifactHash", request.artifactHash)
        )
        .unique()
    );
    if (!storedArtifact) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        `Protected try-out body ${request.contentKey} lost its artifact.`
      );
    }
    const artifact = yield* decodeArtifactJson(storedArtifact.artifactJson);
    if (
      artifact.artifactHash !== request.artifactHash ||
      artifact.payload.contentKey !== request.contentKey ||
      artifact.payload.locale !== request.locale ||
      artifact.payload.rendererDomain !== placement.rendererDomain
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Protected try-out body ${request.contentKey} has mismatched content.`
      );
    }
    return {
      artifactJson: storedArtifact.artifactJson,
      delivery: request.delivery,
      releaseJson: bundle.releaseJson,
      rendererJson: bundle.rendererJson,
      snapshotManifestHash: bundle.manifestHash,
      snapshotReleaseId: bundle.releaseId,
      snapshotId: request.snapshotId,
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
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      `Protected try-out bundle ${request.snapshotReleaseId} is unavailable.`
    );
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

/** Decodes the internal Convex arguments before any storage lookup. */
const readProtectedProgram = Effect.fn("contentRelease.readProtected")(
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
    return yield* resolveProtected(ctx, request);
  }
);

/** Returns one protected artifact after exact snapshot membership checks. */
export const readProtected = internalQuery({
  args: protectedArgsValidator,
  returns: protectedResultValidator,
  handler: (ctx, args) => runConvexProgram(readProtectedProgram(ctx, args)),
});
