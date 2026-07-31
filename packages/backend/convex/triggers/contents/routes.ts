import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { validateSourceMaterialRoutes } from "@repo/backend/convex/contentRelease/material/collision";
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
    validateSourceMaterialRoutes(ctx, [
      {
        locale: route.locale,
        publicPath: route.route,
        sourcePath: route.sourcePath,
      },
    ])
  );
}
