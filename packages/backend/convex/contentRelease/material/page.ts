import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  hasStaleReleaseCursor,
  validateReleaseCursor,
} from "@repo/backend/convex/contentRelease/cursor";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadMaterialOwner } from "@repo/backend/convex/contentRelease/material/owner";
import { verifyMaterial } from "@repo/backend/convex/contentRelease/material/verify";
import { validateProjectionPage } from "@repo/backend/convex/contentRelease/paging";
import { readSourceRevision } from "@repo/backend/convex/contentRelease/runtime/origin";
import { Effect } from "effect";

/** Returns a stable empty material page before Aksara owns the family. */
function emptyPage() {
  return {
    continueCursor: "",
    isDone: true,
    page: [],
  };
}

/** Reads one release-bound page of active localized material projections. */
export const readMaterialPage = Effect.fn("contentRelease.readMaterialPage")(
  function* (
    ctx: QueryCtx,
    locale: Doc<"materialCatalog">["locale"],
    expectedManifestHash: null | string,
    expectedReleaseId: null | string,
    paginationOpts: Parameters<typeof validateProjectionPage>[0]
  ) {
    const [options, owner] = yield* Effect.all([
      validateProjectionPage(paginationOpts),
      loadMaterialOwner(ctx, locale),
    ]);
    if (options.endCursor !== undefined && options.endCursor !== null) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        "Material pages accept only their server-owned continuation cursor."
      );
    }
    const active = owner.managed ? owner.active : null;
    if (
      hasStaleReleaseCursor(
        options.cursor,
        expectedManifestHash,
        expectedReleaseId,
        active
      )
    ) {
      return {
        activeManifestHash: active?.manifestHash ?? null,
        activeReleaseId: active?.releaseId ?? null,
        managed: owner.managed,
        result: emptyPage(),
        sourceRevision: active ? readSourceRevision(active) : null,
        stale: true,
      };
    }
    yield* validateReleaseCursor(
      options.cursor,
      expectedManifestHash,
      expectedReleaseId,
      active
    );
    if (!(owner.managed && owner.active)) {
      return {
        activeManifestHash: owner.active?.manifestHash ?? null,
        activeReleaseId: owner.active?.releaseId ?? null,
        managed: false,
        result: emptyPage(),
        sourceRevision: null,
        stale: false,
      };
    }
    const stored = yield* Effect.promise(() =>
      ctx.db
        .query("materialCatalog")
        .withIndex("by_locale_and_publicPath", (index) =>
          index.eq("locale", locale)
        )
        .paginate(options)
    );
    const verified = yield* Effect.forEach(stored.page, verifyMaterial);
    return {
      activeManifestHash: owner.active.manifestHash,
      activeReleaseId: owner.active.releaseId,
      managed: true,
      result: {
        ...stored,
        page: verified.map(({ projectionJson }) => projectionJson),
      },
      sourceRevision: readSourceRevision(owner.active),
      stale: false,
    };
  }
);
