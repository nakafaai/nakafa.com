import { loadMaterialOwner } from "@repo/backend/content/material/owner";
import { MaterialSource } from "@repo/backend/content/material/source";
import { verifyEffectiveMaterial } from "@repo/backend/content/material/verify";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import {
  decodePageCursor,
  encodePageCursor,
  hasPageCursorPrefix,
  hasStaleReleaseCursor,
  validateReleaseCursor,
} from "@repo/backend/convex/contentRelease/cursor";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
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
    appLocale: PublicationRow<"materialCatalog">["appLocale"],
    expectedManifestHash: null | string,
    expectedReleaseId: null | string,
    paginationOpts: Parameters<typeof validateProjectionPage>[0]
  ) {
    const [options, owner] = yield* Effect.all([
      validateProjectionPage(paginationOpts),
      loadMaterialOwner(appLocale),
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
    const source = yield* MaterialSource;
    const stored = yield* source.page(owner.slot, appLocale, {
      ...options,
      cursor: nativeCursor,
    });
    const verified = yield* Effect.forEach(
      stored.page,
      (row) => verifyEffectiveMaterial(row, activePublication.sequence),
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
