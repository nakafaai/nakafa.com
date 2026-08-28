import { ContentHeadSchema } from "@nakafa/aksara-contracts/release/head";
import {
  canonicalizeContentProjection,
  familyForProjection,
} from "@nakafa/aksara-transition/projection/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import {
  loadRouteBinding,
  loadVersion,
} from "@repo/backend/convex/contentRelease/model";
import { decodeProjectionJson } from "@repo/backend/convex/contentRelease/parse";
import { Effect, Schema } from "effect";

type ReadCtx = MutationCtx | QueryCtx;
/** Converts one complete immutable upsert version into a compact head. */
export const contentHead = Effect.fn("contentRelease.contentHead")(function* (
  head: Doc<"contentHeads">,
  publicPath?: string
) {
  if (
    head.operation !== "upsert" ||
    !head.artifactHash ||
    !head.compilerConfigHash ||
    !head.delivery ||
    !head.projectionHash ||
    !head.projectionJson ||
    !head.rendererDomain ||
    !head.sourceHash ||
    !head.sourcePath
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Content version ${head.contentKey}/${head.artifactLocale}/${head.sequence} is incomplete.`
    );
  }
  return yield* Schema.decodeEffect(ContentHeadSchema)({
    artifactHash: head.artifactHash,
    artifactLocale: head.artifactLocale,
    compilerConfigHash: head.compilerConfigHash,
    contentKey: head.contentKey,
    delivery: head.delivery,
    family: head.family,
    projectionHash: head.projectionHash,
    ...(publicPath === undefined ? {} : { publicPath }),
    rendererDomain: head.rendererDomain,
    sourceHash: head.sourceHash,
    sourcePath: head.sourcePath,
  }).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Content version ${head.contentKey}/${head.artifactLocale}/${head.sequence} violates the content-head contract.`,
        })
    )
  );
});
/** Resolves and validates one content head's canonical published route. */
const resolvePublicPath = Effect.fn("contentRelease.resolvePublicPath")(
  function* (ctx: ReadCtx, head: Doc<"contentHeads">, activeSequence: number) {
    if (!head.projectionJson) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content ${head.contentKey}/${head.artifactLocale} lost its projection.`
      );
    }
    const projection = yield* decodeProjectionJson(head.projectionJson);
    if (familyForProjection(projection) !== head.family) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content ${head.contentKey}/${head.artifactLocale} changed projection family.`
      );
    }
    if (projection.kind === "question-body") {
      return;
    }
    if (projection.artifactLocale !== head.artifactLocale) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content ${head.contentKey}/${head.artifactLocale} changed projection locale.`
      );
    }
    const binding = yield* loadRouteBinding(
      ctx,
      projection.appLocale,
      projection.publicPath,
      activeSequence
    );
    if (
      binding?.operation !== "bind" ||
      binding.contentKey !== head.contentKey
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_ROUTE",
        `Content ${head.contentKey}/${head.artifactLocale} lost its canonical route.`
      );
    }
    if (
      binding.sequence === head.sequence &&
      binding.releaseId !== head.releaseId
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Route for ${head.contentKey}/${head.artifactLocale} disagrees at one sequence.`
      );
    }
    return projection.publicPath;
  }
);
/** Resolves one exact public projection selected by a frozen sequence. */
export const resolvePublicProjection = Effect.fn(
  "contentRelease.resolvePublicProjection"
)(function* (
  ctx: ReadCtx,
  contentKey: string,
  artifactLocale: Doc<"contentKeys">["artifactLocale"],
  sequence: number
) {
  const head = yield* loadVersion(ctx, contentKey, artifactLocale, sequence);
  if (!head || head.operation === "delete" || head.delivery !== "public") {
    return null;
  }
  if (!(head.projectionHash && head.projectionJson)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Public content ${contentKey}/${artifactLocale} lost its projection.`
    );
  }
  const projection = yield* decodeProjectionJson(head.projectionJson);
  if (projection.kind === "question-body") {
    return null;
  }
  const publicPath = yield* resolvePublicPath(ctx, head, sequence);
  if (publicPath === undefined) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Public content ${contentKey}/${artifactLocale} lost its routed projection.`
    );
  }
  const projectionHash = yield* hashText(
    "the public content projection",
    canonicalizeContentProjection(projection)
  );
  if (
    familyForProjection(projection) !== head.family ||
    projection.contentKey !== head.contentKey ||
    projection.artifactLocale !== head.artifactLocale ||
    projection.publicPath !== publicPath ||
    projectionHash !== head.projectionHash
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Public content ${contentKey}/${artifactLocale} has mismatched projection data.`
    );
  }
  if (!(head.rendererDomain && head.sourcePath)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Public content ${contentKey}/${artifactLocale} lost its renderer provenance.`
    );
  }
  return {
    appLocale: projection.appLocale,
    artifactLocale: head.artifactLocale,
    contentKey: head.contentKey,
    family: head.family,
    projectionHash,
    projectionJson: head.projectionJson,
    publicPath,
    releaseId: head.releaseId,
    rendererDomain: head.rendererDomain,
    sequence: head.sequence,
    sourcePath: head.sourcePath,
  };
});
/** Resolves one effective immutable head from a frozen sequence snapshot. */
export const resolveContentHead = Effect.fn(
  "contentRelease.resolveContentHead"
)(function* (
  ctx: ReadCtx,
  contentKey: string,
  artifactLocale: Doc<"contentKeys">["artifactLocale"],
  sequence: number
) {
  const head = yield* loadVersion(ctx, contentKey, artifactLocale, sequence);
  if (!head || head.operation === "delete") {
    return null;
  }
  const publicPath = yield* resolvePublicPath(ctx, head, sequence);
  return yield* contentHead(head, publicPath);
});
