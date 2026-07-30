import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { resolvePublicProjection } from "@repo/backend/convex/contentRelease/catalog";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

interface ExactMaterialOwner {
  readonly contentKey: string;
  readonly locale: ContentLocale;
}

/** Checks whether one selected exact owner displaces the source route. */
function ownsSourceRoute(
  expected: readonly ExactMaterialOwner[],
  locale: ContentLocale,
  sourcePath: string | undefined
) {
  return expected.some(
    (owner) => owner.locale === locale && owner.contentKey === sourcePath
  );
}

/** Proves every exact route displaces only another selected source owner. */
export const validateExactMaterialRoutes = Effect.fn(
  "contentRelease.validateExactMaterialRoutes"
)(function* (
  ctx: MutationCtx,
  sequence: number,
  expected: readonly ExactMaterialOwner[]
) {
  for (const owner of expected) {
    const projection = yield* resolvePublicProjection(
      ctx,
      owner.contentKey,
      owner.locale,
      sequence
    );
    if (!projection) {
      continue;
    }
    if (projection.family !== "material") {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Exact material ${owner.contentKey}/${owner.locale} resolved a different family before activation.`
      );
    }
    const sourceRoutes = yield* Effect.promise(() =>
      ctx.db
        .query("publicRoutes")
        .withIndex("by_locale_and_publicPath", (index) =>
          index
            .eq("locale", projection.locale)
            .eq("publicPath", projection.publicPath)
        )
        .take(2)
    );
    if (sourceRoutes.length > 1) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Source route ${projection.locale}/${projection.publicPath} has multiple owners.`
      );
    }
    if (
      sourceRoutes.length === 0 ||
      ownsSourceRoute(
        expected,
        projection.locale,
        sourceRoutes.at(0)?.sourcePath
      )
    ) {
      continue;
    }
    return yield* releaseFail(
      "CONTENT_RELEASE_ROUTE",
      `Exact material ${owner.contentKey}/${owner.locale} conflicts with retained source route ${projection.publicPath}.`
    );
  }
});
