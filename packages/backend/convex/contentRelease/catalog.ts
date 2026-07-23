import { MaterialHeadSchema } from "@nakafa/aksara-contracts/release/head";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
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
export const materialHead = Effect.fn("contentRelease.materialHead")(function* (
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
      `Content version ${head.contentKey}/${head.locale}/${head.sequence} is incomplete.`
    );
  }
  return yield* Schema.decodeUnknown(MaterialHeadSchema)({
    artifactHash: head.artifactHash,
    compilerConfigHash: head.compilerConfigHash,
    contentKey: head.contentKey,
    delivery: head.delivery,
    locale: head.locale,
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
          message: `Content version ${head.contentKey}/${head.locale}/${head.sequence} violates the material-head contract.`,
        })
    )
  );
});

/** Resolves and validates one material head's canonical published route. */
const resolvePublicPath = Effect.fn("contentRelease.resolvePublicPath")(
  function* (ctx: ReadCtx, head: Doc<"contentHeads">, activeSequence: number) {
    if (!head.projectionJson) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content ${head.contentKey}/${head.locale} lost its projection.`
      );
    }
    const projection = yield* decodeProjectionJson(head.projectionJson);
    const binding = yield* loadRouteBinding(
      ctx,
      head.locale,
      projection.publicPath,
      activeSequence
    );
    if (
      binding?.operation !== "bind" ||
      binding.contentKey !== head.contentKey
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_ROUTE",
        `Content ${head.contentKey}/${head.locale} lost its canonical route.`
      );
    }
    if (
      binding.sequence === head.sequence &&
      binding.releaseId !== head.releaseId
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Route for ${head.contentKey}/${head.locale} disagrees at one sequence.`
      );
    }
    return projection.publicPath;
  }
);

/** Resolves one effective immutable head from a frozen sequence snapshot. */
export const resolveMaterialHead = Effect.fn(
  "contentRelease.resolveMaterialHead"
)(function* (
  ctx: ReadCtx,
  contentKey: string,
  locale: Doc<"contentKeys">["locale"],
  sequence: number
) {
  const head = yield* loadVersion(ctx, contentKey, locale, sequence);
  if (!head || head.operation === "delete") {
    return null;
  }
  const publicPath = yield* resolvePublicPath(ctx, head, sequence);
  return yield* materialHead(head, publicPath);
});
