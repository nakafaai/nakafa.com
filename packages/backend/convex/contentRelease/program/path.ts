import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadProgramRouteRow } from "@repo/backend/convex/contentRelease/program/model";
import { loadProgramOwner } from "@repo/backend/convex/contentRelease/program/owner";
import { verifyCurriculum } from "@repo/backend/convex/contentRelease/program/verify";
import { Effect } from "effect";

/** Resolves lightweight curriculum ownership for proxy and locale routing. */
export const readProgramPath = Effect.fn("contentRelease.readProgramPath")(
  function* (
    ctx: QueryCtx,
    locale: Doc<"curriculumRoutes">["locale"],
    publicPath: string
  ) {
    const owner = yield* loadProgramOwner(ctx, locale);
    if (!(owner.managed && owner.selected)) {
      return { managed: false, routeJson: null };
    }
    const route = yield* loadProgramRouteRow(
      ctx,
      owner.selected.snapshotId,
      locale,
      publicPath
    );
    if (!route) {
      return { managed: true, routeJson: null };
    }
    yield* verifyCurriculum(route, owner.selected.snapshotId);
    return { managed: true, routeJson: route.rowJson };
  }
);
