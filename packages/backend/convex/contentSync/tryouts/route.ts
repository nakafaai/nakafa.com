import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { deleteContentProjectionsBySourcePath } from "@repo/backend/convex/contentSync/lib/syncHelpers";
import type { SyncedTryoutRoute } from "@repo/backend/convex/contentSync/tryouts/spec";
import { getContentGraphIdentity } from "@repo/backend/convex/contents/graph";
import { syncContentRoute } from "@repo/backend/convex/contents/helpers/routes/write";
import { getContentSearchText } from "@repo/backend/convex/contents/helpers/search/documents";
import { syncContentSearch } from "@repo/backend/convex/contents/helpers/search/write";
import { Effect } from "effect";

/** Reconciles one try-out route across route lookup and agent-search read models. */
export const syncTryoutRoute = Effect.fn("contentSync.tryout.syncRoute")(
  function* (ctx: MutationCtx, route: SyncedTryoutRoute, syncedAt: number) {
    if (!route.isReady) {
      yield* Effect.promise(() =>
        deleteContentProjectionsBySourcePath(ctx, {
          locale: route.locale,
          route: route.sourcePath,
        })
      );
      return;
    }

    const graph = getContentGraphIdentity({
      kind: route.kind,
      locale: route.locale,
      route: route.sourcePath,
    });

    yield* Effect.promise(() =>
      syncContentSearch(ctx, {
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
      })
    );
    yield* Effect.promise(() =>
      syncContentRoute(ctx, {
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
      })
    );
  }
);
