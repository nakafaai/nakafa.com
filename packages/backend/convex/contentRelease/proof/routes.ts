import { ArtifactLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { familyForProjection } from "@nakafa/aksara-contracts/projection/spec";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadRouteBinding,
  loadVersion,
} from "@repo/backend/convex/contentRelease/model";
import { decodeProjectionJson } from "@repo/backend/convex/contentRelease/parse";
import { catalogRelease } from "@repo/backend/convex/contentRelease/proof/catalog";
import {
  PROOF_PAGE_BYTES,
  ROUTE_CATALOG_PAGE_LIMIT,
} from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";

const routeCatalogValidator = v.object({
  checked: v.number(),
  done: v.boolean(),
  nextCursor: v.union(v.string(), v.null()),
});

export interface RouteCatalogPage {
  readonly checked: number;
  readonly done: boolean;
  readonly nextCursor: null | string;
}

/** Validates one bounded active-route directory page at a frozen sequence. */
const routeProgram = Effect.fn("contentRelease.routeCatalogPage")(function* (
  ctx: QueryCtx,
  releaseId: string,
  cursor: null | string
) {
  const release = yield* catalogRelease(ctx, releaseId);
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("contentPaths")
      .withIndex("by_createdSequence_and_appLocale_and_publicPath", (query) =>
        query.lte("createdSequence", release.sequence)
      )
      .order("asc")
      .paginate({
        cursor,
        maximumBytesRead: PROOF_PAGE_BYTES,
        maximumRowsRead: ROUTE_CATALOG_PAGE_LIMIT,
        numItems: ROUTE_CATALOG_PAGE_LIMIT,
      })
  );
  for (const path of stored.page) {
    const binding = yield* loadRouteBinding(
      ctx,
      path.appLocale,
      path.publicPath,
      release.sequence
    );
    if (!binding || binding.operation === "delete") {
      continue;
    }
    if (!binding.contentKey) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Route ${path.appLocale}/${path.publicPath} lost its content key.`
      );
    }
    const head = yield* loadVersion(
      ctx,
      binding.contentKey,
      ArtifactLocaleSchema.make(path.appLocale),
      release.sequence
    );
    if (head?.operation !== "upsert") {
      return yield* releaseFail(
        "CONTENT_RELEASE_ROUTE",
        `Route ${path.appLocale}/${path.publicPath} targets missing content.`
      );
    }
    if (!head.projectionJson) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Route ${path.appLocale}/${path.publicPath} lost its projection.`
      );
    }
    const projection = yield* decodeProjectionJson(head.projectionJson);
    if (projection.kind === "question-body") {
      return yield* releaseFail(
        "CONTENT_RELEASE_ROUTE",
        `Route ${path.appLocale}/${path.publicPath} targets a protected question body.`
      );
    }
    if (
      projection.contentKey !== binding.contentKey ||
      familyForProjection(projection) !== head.family ||
      projection.appLocale !== path.appLocale ||
      projection.publicPath !== path.publicPath
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_ROUTE",
        `Route ${path.appLocale}/${path.publicPath} disagrees with its projection.`
      );
    }
    if (
      head.sequence === binding.sequence &&
      head.releaseId !== binding.releaseId
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Route ${path.appLocale}/${path.publicPath} disagrees at one sequence.`
      );
    }
  }
  return {
    checked: stored.page.length,
    done: stored.isDone,
    nextCursor: stored.isDone ? null : stored.continueCursor,
  } satisfies RouteCatalogPage;
});

/** Returns one bounded route catalog page after validating every owner. */
export const routes = internalQuery({
  args: { cursor: v.union(v.string(), v.null()), releaseId: v.string() },
  returns: routeCatalogValidator,
  handler: (ctx, args) =>
    runConvexProgram(routeProgram(ctx, args.releaseId, args.cursor)),
});
