import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  decodePageCursor,
  encodePageCursor,
  hasPageCursorPrefix,
  hasStaleReleaseCursor,
  validateReleaseCursor,
} from "@repo/backend/convex/contentRelease/cursor";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadMaterialOwner } from "@repo/backend/convex/contentRelease/material/owner";
import { verifyEffectiveMaterial } from "@repo/backend/convex/contentRelease/material/verify";
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
    appLocale: Doc<"materialCatalog">["appLocale"],
    expectedManifestHash: null | string,
    expectedReleaseId: null | string,
    paginationOpts: Parameters<typeof validateProjectionPage>[0]
  ) {
    const [options, owner] = yield* Effect.all([
      validateProjectionPage(paginationOpts),
      loadMaterialOwner(ctx, appLocale),
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
      ) ||
      !hasPageCursorPrefix(options.cursor)
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
    if (!(owner.managed && owner.active && owner.slot)) {
      return {
        activeManifestHash: owner.active?.manifestHash ?? null,
        activeReleaseId: owner.active?.releaseId ?? null,
        managed: false,
        result: emptyPage(),
        sourceRevision: null,
        stale: false,
      };
    }
    const activePublication = owner.active;
    const nativeCursor = yield* decodePageCursor(
      options.cursor,
      "material",
      owner.slot
    );
    const stored = yield* Effect.promise(() =>
      ctx.db
        .query("materialCatalog")
        .withIndex("by_slot_and_appLocale_and_publicPath", (index) =>
          index.eq("slot", owner.slot).eq("appLocale", appLocale)
        )
        .paginate({ ...options, cursor: nativeCursor })
    );
    const verified = yield* Effect.forEach(
      stored.page,
      (row) => verifyEffectiveMaterial(ctx, row, activePublication.sequence),
      { concurrency: "unbounded" }
    );
    const page = verified.map(({ resolved }) => resolved.projectionJson);
    return {
      activeManifestHash: activePublication.manifestHash,
      activeReleaseId: activePublication.releaseId,
      managed: true,
      result: {
        ...stored,
        continueCursor: encodePageCursor(
          "material",
          owner.slot,
          stored.continueCursor
        ),
        page,
        ...(stored.splitCursor === undefined || stored.splitCursor === null
          ? {}
          : {
              splitCursor: encodePageCursor(
                "material",
                owner.slot,
                stored.splitCursor
              ),
            }),
      },
      sourceRevision: readSourceRevision(activePublication),
      stale: false,
    };
  }
);
