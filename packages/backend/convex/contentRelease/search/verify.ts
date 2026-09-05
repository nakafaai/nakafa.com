import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import { resolvePublicProjection } from "@repo/backend/content/publication/projection";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import type { loadSearchOwner } from "@repo/backend/convex/contentRelease/search/owner";
import { Effect } from "effect";

export type SearchModelOwner = NonNullable<
  Effect.Success<ReturnType<typeof loadSearchOwner>>
>;
/** Resolves one indexed hit through the active release's structural sharing. */
export const resolveSearchProjection = Effect.fn(
  "contentRelease.resolveSearchProjection"
)(function* (ctx: QueryCtx, row: Doc<"contentIndex">, owner: SearchModelOwner) {
  if (row.slot !== owner.slot || !owner.families.includes(row.family)) {
    return yield* staleSearchRow(row);
  }
  const resolved = yield* resolvePublicProjection(
    row.contentKey,
    row.appLocale,
    owner.sequence
  ).pipe(Effect.provide(convexPublicationLayer(ctx)));
  if (
    !resolved ||
    resolved.appLocale !== row.appLocale ||
    resolved.family !== row.family ||
    resolved.projectionHash !== row.projectionHash ||
    resolved.publicPath !== row.publicPath ||
    resolved.releaseId !== row.releaseId ||
    resolved.sequence !== row.sequence
  ) {
    return yield* staleSearchRow(row);
  }
  return resolved;
});
/** Creates one typed integrity failure for a stale release-owned search row. */
function staleSearchRow(
  row: Pick<Doc<"contentIndex">, "appLocale" | "contentKey">
) {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    `Active search entry ${row.contentKey}/${row.appLocale} is stale.`
  );
}
