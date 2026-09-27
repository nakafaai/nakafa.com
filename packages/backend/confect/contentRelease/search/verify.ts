import type { Docs } from "@repo/backend/confect/_generated/docs";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import type { loadSearchOwner } from "@repo/backend/confect/contentRelease/search/owner";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { resolvePublicProjection } from "@repo/backend/content/publication/projection";
import { Effect } from "effect";
export type SearchModelOwner = NonNullable<
  Effect.Success<ReturnType<typeof loadSearchOwner>>
>;
/** Resolves one indexed hit through the active release's structural sharing. */
export const resolveSearchProjection = Effect.fn(
  "contentRelease.resolveSearchProjection"
)(function* (row: Docs["contentIndex"], owner: SearchModelOwner) {
  if (row.slot !== owner.slot || !owner.families.includes(row.family)) {
    return yield* staleSearchRow(row);
  }
  const resolved = yield* resolvePublicProjection(
    row.contentKey,
    row.appLocale,
    owner.sequence
  ).pipe(Effect.provide(publicationLayer));
  if (!resolved) {
    return yield* staleSearchRow(row);
  }
  const projection = resolved.projection;
  if (projection.kind !== "article" && projection.kind !== "subject-lesson") {
    return yield* staleSearchRow(row);
  }
  if (
    resolved.family !== row.family ||
    resolved.projectionHash !== row.projectionHash ||
    resolved.publicPath !== row.publicPath ||
    resolved.releaseId !== row.releaseId ||
    resolved.sequence !== row.sequence
  ) {
    return yield* staleSearchRow(row);
  }
  return {
    ...resolved,
    projection,
  };
});
/** Creates one typed integrity failure for a stale release-owned search row. */
function staleSearchRow(
  row: Pick<Docs["contentIndex"], "appLocale" | "contentKey">
) {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    `Active search entry ${row.contentKey}/${row.appLocale} is stale.`
  );
}
