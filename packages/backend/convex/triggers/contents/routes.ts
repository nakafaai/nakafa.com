import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { validateSourceMaterialRoute } from "@repo/backend/convex/contentRelease/material/routeGuard";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type { Change } from "convex-helpers/server/triggers";

/** Validates new concrete source identities against protected material routes. */
export async function contentRoutesHandler(
  ctx: MutationCtx,
  change: Change<DataModel, "contentRoutes">
) {
  const route = change.newDoc;
  if (!route) {
    return;
  }
  const previous = change.oldDoc;
  if (
    previous?.locale === route.locale &&
    previous.route === route.route &&
    previous.sourcePath === route.sourcePath
  ) {
    return;
  }
  await runConvexProgram(
    validateSourceMaterialRoute(ctx, {
      locale: route.locale,
      publicPath: route.route,
      sourcePath: route.sourcePath,
    })
  );
}
