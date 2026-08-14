import {
  canonicalizeContentProjection,
  familyForProjection,
} from "@nakafa/aksara-contracts/projection/spec";
import { PUBLIC_CONTENT_RUNTIME_BATCH_SIZE } from "@repo/backend/content/batch";
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
  decodeProjectionJson,
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

const publicResultValidator = v.union(
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
const publicRequestValidator = v.object({
  locale: localeValidator,
  publicPath: v.string(),
});
const publicBatchResultValidator = v.array(publicResultValidator);

type ContentLocale = Infer<typeof localeValidator>;
type ActiveIdentity = NonNullable<
  Effect.Effect.Success<ReturnType<typeof loadActiveIdentity>>
>;

/** Stored active public row returned only to the authenticated HTTP adapter. */
export type PublicRuntimeRow = Infer<typeof publicResultValidator>;

/** Resolves an active route and enforces its public delivery class. */
const resolvePublicRouteForActive = Effect.fn(
  "contentRelease.resolvePublicRouteForActive"
)(function* (
  ctx: QueryCtx,
  active: ActiveIdentity,
  locale: ContentLocale,
  publicPath: string
) {
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
  if (head.delivery !== "public") {
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
  const projection = yield* decodeProjectionJson(head.projectionJson);
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
    delivery: head.delivery,
    projectionHash,
    projectionJson: head.projectionJson,
    releaseJson: active.release.releaseJson,
    rendererJson: active.release.rendererJson,
    sourcePath: head.sourcePath,
  };
});

/** Resolves one active public route for the singular runtime endpoint. */
const resolvePublicRoute = Effect.fn("contentRelease.resolvePublicRoute")(
  function* (ctx: QueryCtx, locale: ContentLocale, publicPath: string) {
    const active = yield* loadActiveIdentity(ctx);
    if (!active) {
      return null;
    }
    return yield* resolvePublicRouteForActive(ctx, active, locale, publicPath);
  }
);

/** Resolves one bounded public batch inside one consistent transaction. */
const resolvePublicRoutes = Effect.fn("contentRelease.resolvePublicRoutes")(
  function* (
    ctx: QueryCtx,
    requests: readonly {
      readonly locale: ContentLocale;
      readonly publicPath: string;
    }[]
  ) {
    if (
      requests.length === 0 ||
      requests.length > PUBLIC_CONTENT_RUNTIME_BATCH_SIZE
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Public runtime batch exceeded its transaction bound."
      );
    }
    const active = yield* loadActiveIdentity(ctx);
    if (!active) {
      return requests.map(() => null);
    }
    return yield* Effect.forEach(requests, (request) =>
      resolvePublicRouteForActive(
        ctx,
        active,
        request.locale,
        request.publicPath
      )
    );
  }
);

/** Returns one public artifact only to the server-authenticated HTTP adapter. */
export const read = internalQuery({
  args: { locale: localeValidator, publicPath: v.string() },
  returns: publicResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(resolvePublicRoute(ctx, args.locale, args.publicPath)),
});

/** Returns one ordered public batch to the authenticated HTTP adapter. */
export const readBatch = internalQuery({
  args: { requests: v.array(publicRequestValidator) },
  returns: publicBatchResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(resolvePublicRoutes(ctx, args.requests)),
});
