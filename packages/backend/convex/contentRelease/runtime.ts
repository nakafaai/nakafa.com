import type { ContentDeliveryClass } from "@nakafa/aksara-contracts/delivery";
import {
  canonicalizeContentProjection,
  familyForProjection,
} from "@nakafa/aksara-contracts/projection/spec";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadRouteBinding,
  loadVersion,
} from "@repo/backend/convex/contentRelease/model";
import {
  decodeArtifactJson,
  decodeProjectionWireJson,
} from "@repo/backend/convex/contentRelease/parse";
import { loadActiveIdentity } from "@repo/backend/convex/contentRelease/runtime/active";
import {
  deliveryValidator,
  localeValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { Effect } from "effect";

const routeResultValidator = v.union(
  v.null(),
  v.object({
    activeManifestHash: v.string(),
    activeReleaseId: v.string(),
    artifactJson: v.string(),
    delivery: deliveryValidator,
    projectionHash: v.string(),
    projectionJson: v.string(),
    releaseJson: v.string(),
    rendererJson: v.string(),
    sourcePath: v.string(),
  })
);

type ContentLocale = Infer<typeof localeValidator>;
/** Stored active runtime row returned only through delivery-specific reads. */
export type RuntimeRow = Infer<typeof routeResultValidator>;

/** Resolves a route first, then enforces its stored delivery class. */
const resolveRoute = Effect.fn("contentRelease.resolveRoute")(function* (
  ctx: QueryCtx,
  locale: ContentLocale,
  publicPath: string,
  delivery: ContentDeliveryClass
) {
  const active = yield* loadActiveIdentity(ctx);
  if (!active) {
    return null;
  }
  const binding = yield* loadRouteBinding(
    ctx,
    locale,
    publicPath,
    active.sequence
  );
  if (!binding || binding.operation === "delete") {
    return null;
  }
  if (!binding.contentKey) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Published route ${locale}/${publicPath} lost its content identity.`
    );
  }
  const head = yield* loadVersion(
    ctx,
    binding.contentKey,
    locale,
    active.sequence
  );
  if (head?.operation !== "upsert") {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Published route ${locale}/${publicPath} lost its active head.`
    );
  }
  if (
    head.sequence === binding.sequence &&
    head.releaseId !== binding.releaseId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Published route ${locale}/${publicPath} disagrees at one sequence.`
    );
  }
  if (head.delivery !== delivery) {
    return null;
  }
  if (
    !(
      head.artifactHash &&
      head.compilerConfigHash &&
      head.projectionHash &&
      head.projectionJson &&
      head.rendererDomain &&
      head.sourceHash &&
      head.sourcePath
    )
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Published route ${locale}/${publicPath} lost runtime fields.`
    );
  }
  const artifactHash = head.artifactHash;
  const artifact = yield* Effect.promise(() =>
    ctx.db
      .query("contentArtifacts")
      .withIndex("by_artifactHash", (query) =>
        query.eq("artifactHash", artifactHash)
      )
      .unique()
  );
  if (!artifact) {
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      `Published route ${locale}/${publicPath} lost its artifact.`
    );
  }
  const decodedArtifact = yield* decodeArtifactJson(artifact.artifactJson);
  const projection = yield* decodeProjectionWireJson(head.projectionJson);
  const projectionHash = yield* hashText(
    "the published content projection",
    canonicalizeContentProjection(projection)
  );
  if (
    decodedArtifact.artifactHash !== head.artifactHash ||
    decodedArtifact.payload.contentKey !== head.contentKey ||
    decodedArtifact.payload.compilerConfigHash !== head.compilerConfigHash ||
    decodedArtifact.payload.locale !== locale ||
    decodedArtifact.payload.rendererDomain !== head.rendererDomain ||
    decodedArtifact.payload.sourceHash !== head.sourceHash ||
    familyForProjection(projection) !== head.family ||
    projection.kind === "question-body" ||
    projectionHash !== head.projectionHash ||
    projection.contentKey !== head.contentKey ||
    projection.locale !== locale ||
    projection.publicPath !== publicPath
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Published route ${locale}/${publicPath} has mismatched content.`
    );
  }
  return {
    activeManifestHash: active.manifestHash,
    activeReleaseId: active.releaseId,
    artifactJson: artifact.artifactJson,
    delivery,
    projectionHash,
    projectionJson: head.projectionJson,
    releaseJson: active.release.releaseJson,
    rendererJson: active.release.rendererJson,
    sourcePath: head.sourcePath,
  };
});

const routeArgs = { locale: localeValidator, publicPath: v.string() };

/** Returns one public artifact only to the server-authenticated HTTP adapter. */
export const readPublic = internalQuery({
  args: routeArgs,
  returns: routeResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(resolveRoute(ctx, args.locale, args.publicPath, "public")),
});
