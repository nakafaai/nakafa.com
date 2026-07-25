import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { query } from "@repo/backend/convex/_generated/server";
import { resolvePublicProjection } from "@repo/backend/convex/contentRelease/catalog";
import { validateProjectionPage } from "@repo/backend/convex/contentRelease/paging";
import { loadActiveIdentity } from "@repo/backend/convex/contentRelease/runtime/active";
import {
  contentFamilyValidator,
  localeValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { Effect } from "effect";

const projectionValidator = v.object({
  contentKey: v.string(),
  family: contentFamilyValidator,
  locale: localeValidator,
  projectionHash: v.string(),
  projectionJson: v.string(),
  publicPath: v.string(),
  releaseId: v.string(),
  sequence: v.number(),
});

const pageValidator = v.object({
  activeManifestHash: v.union(v.string(), v.null()),
  activeReleaseId: v.union(v.string(), v.null()),
  result: paginationResultValidator(projectionValidator),
});

type ProjectionRow = Infer<typeof projectionValidator>;
type ProjectionFamily = Infer<typeof contentFamilyValidator>;
type ProjectionLocale = Infer<typeof localeValidator>;

/** Reads one bounded permanent-key page against the active projection state. */
const readPage = Effect.fn("contentRelease.readProjectionPage")(function* (
  ctx: QueryCtx,
  family: ProjectionFamily,
  locale: ProjectionLocale,
  paginationOpts: Parameters<typeof validateProjectionPage>[0]
) {
  const options = yield* validateProjectionPage(paginationOpts);
  const [active, stored] = yield* Effect.all([
    loadActiveIdentity(ctx),
    Effect.promise(() =>
      ctx.db
        .query("contentKeys")
        .withIndex(
          "by_family_and_locale_and_createdSequence_and_contentKey",
          (index) => index.eq("family", family).eq("locale", locale)
        )
        .paginate(options)
    ),
  ]);
  const page: ProjectionRow[] = [];
  if (active) {
    for (const key of stored.page) {
      const projection = yield* resolvePublicProjection(
        ctx,
        key.contentKey,
        key.locale,
        active.sequence
      );
      if (projection) {
        page.push(projection);
      }
    }
  }
  return {
    activeManifestHash: active?.manifestHash ?? null,
    activeReleaseId: active?.releaseId ?? null,
    result: { ...stored, page },
  };
});

/** Returns one active public projection page without copying release catalogs. */
export const read = query({
  args: {
    family: contentFamilyValidator,
    locale: localeValidator,
    paginationOpts: paginationOptsValidator,
  },
  returns: pageValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      readPage(ctx, args.family, args.locale, args.paginationOpts)
    ),
});
