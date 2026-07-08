import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { SyncedTryoutRoute } from "@repo/backend/convex/contentSync/tryouts/spec";
import { getContentGraphIdentity } from "@repo/backend/convex/contents/graph";
import { syncContentRoute } from "@repo/backend/convex/contents/helpers/routes/write";
import { getContentSearchText } from "@repo/backend/convex/contents/helpers/search/documents";
import { syncContentSearch } from "@repo/backend/convex/contents/helpers/search/write";

/** Syncs a try-out route into both route lookup and agent-search read models. */
export async function syncTryoutRoute(
  ctx: MutationCtx,
  route: SyncedTryoutRoute,
  syncedAt: number
) {
  const graph = getContentGraphIdentity({
    kind: route.kind,
    locale: route.locale,
    route: route.sourcePath,
  });

  await syncContentSearch(ctx, {
    ...graph,
    contentHash: route.contentHash,
    description: route.description,
    locale: route.locale,
    route: route.publicPath,
    section: "tryout",
    sourcePath: route.sourcePath,
    syncedAt,
    text: getContentSearchText([
      route.title,
      route.description,
      route.publicPath,
    ]),
    title: route.title,
  });
  await syncContentRoute(ctx, {
    ...graph,
    contentHash: route.contentHash,
    description: route.description,
    kind: route.kind,
    locale: route.locale,
    markdown: false,
    publicPath: route.publicPath,
    section: "tryout",
    sourcePath: route.sourcePath,
    syncedAt,
    title: route.title,
  });
}
