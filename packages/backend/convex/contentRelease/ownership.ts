import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { query } from "@repo/backend/convex/_generated/server";
import { resolvePublicProjection } from "@repo/backend/convex/contentRelease/catalog";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadRouteBinding } from "@repo/backend/convex/contentRelease/model";
import { loadActiveIdentity } from "@repo/backend/convex/contentRelease/runtime/active";
import {
  contentFamilyValidator,
  localeValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { Effect } from "effect";

const routeResultValidator = v.union(
  v.object({
    activeReleaseId: v.union(v.string(), v.null()),
    kind: v.literal("unmanaged"),
  }),
  v.object({
    activeReleaseId: v.string(),
    kind: v.literal("missing"),
  }),
  v.object({
    activeReleaseId: v.string(),
    kind: v.literal("found"),
    projectionJson: v.string(),
  })
);

type ContentFamily = Infer<typeof contentFamilyValidator>;
type ContentLocale = Infer<typeof localeValidator>;
type RouteResult = Infer<typeof routeResultValidator>;

/** Reads one permanent route identity without exposing artifact code. */
const loadContentPath = Effect.fn("contentRelease.loadContentPath")(function* (
  ctx: QueryCtx,
  locale: ContentLocale,
  publicPath: string
) {
  const rows = yield* Effect.promise(() =>
    ctx.db
      .query("contentPaths")
      .withIndex("by_locale_and_publicPath", (index) =>
        index.eq("locale", locale).eq("publicPath", publicPath)
      )
      .take(2)
  );
  if (rows.length > 1) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Route ${locale}/${publicPath} has duplicate ownership.`
    );
  }
  return rows[0] ?? null;
});

/** Resolves one public route from the exact active publication sequence. */
const resolveActiveRoute = Effect.fn("contentRelease.resolveActiveRoute")(
  function* (
    ctx: QueryCtx,
    family: ContentFamily,
    locale: ContentLocale,
    publicPath: string
  ) {
    const active = yield* loadActiveIdentity(ctx);
    if (!active) {
      return {
        activeReleaseId: null,
        kind: "unmanaged",
      } satisfies RouteResult;
    }
    const path = yield* loadContentPath(ctx, locale, publicPath);
    if (!path || path.createdSequence > active.sequence) {
      return {
        activeReleaseId: active.releaseId,
        kind: "unmanaged",
      } satisfies RouteResult;
    }
    const binding = yield* loadRouteBinding(
      ctx,
      locale,
      publicPath,
      active.sequence
    );
    if (!binding || binding.operation === "delete") {
      return {
        activeReleaseId: active.releaseId,
        kind: "missing",
      } satisfies RouteResult;
    }
    if (!binding.contentKey) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Route ${locale}/${publicPath} lost its content identity.`
      );
    }
    const projection = yield* resolvePublicProjection(
      ctx,
      binding.contentKey,
      locale,
      active.sequence
    );
    if (
      !projection ||
      projection.family !== family ||
      projection.publicPath !== publicPath
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Route ${locale}/${publicPath} lost its ${family} projection.`
      );
    }

    return {
      activeReleaseId: active.releaseId,
      kind: "found",
      projectionJson: projection.projectionJson,
    } satisfies RouteResult;
  }
);

/** Returns active public-route ownership without exposing artifact code. */
export const resolve = query({
  args: {
    family: contentFamilyValidator,
    locale: localeValidator,
    publicPath: v.string(),
  },
  returns: routeResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      resolveActiveRoute(ctx, args.family, args.locale, args.publicPath)
    ),
});
