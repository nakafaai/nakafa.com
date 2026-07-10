import type { internal } from "@repo/backend/convex/_generated/api";
import { listPublicRoutes } from "@repo/contents/_types/route/projection";
import type { PublicRoute } from "@repo/contents/_types/route/schema";
import type { FunctionArgs } from "convex/server";
import { Effect } from "effect";

type PublicRoutePayload = FunctionArgs<
  typeof internal.contentSync.mutations.readModels.routes.bulkSyncPublicRoutes
>["routes"][number];

/** Builds public route rows from the source-owned route projection. */
export const readPublicRouteRows = Effect.fn("sync.readPublicRouteRows")(
  function* () {
    const routes = yield* listPublicRoutes();
    return routes.map(toPublicRoutePayload);
  }
);

/** Converts one source route into the durable Convex route contract. */
function toPublicRoutePayload(route: PublicRoute): PublicRoutePayload {
  return {
    canonicalPath: "canonicalPath" in route ? route.canonicalPath : undefined,
    description: "description" in route ? route.description : undefined,
    displayGroupIconKey:
      "displayGroupIconKey" in route ? route.displayGroupIconKey : undefined,
    displayGroupTitle:
      "displayGroupTitle" in route ? route.displayGroupTitle : undefined,
    iconKey: "iconKey" in route ? route.iconKey : undefined,
    kind: route.kind,
    level: "level" in route ? route.level : undefined,
    locale: route.locale,
    materialCardDescription:
      "materialCardDescription" in route
        ? route.materialCardDescription
        : undefined,
    materialCardTitle:
      "materialCardTitle" in route ? route.materialCardTitle : undefined,
    materialDomain:
      "materialDomain" in route ? route.materialDomain : undefined,
    materialKey: "materialKey" in route ? route.materialKey : undefined,
    nodeKey: "nodeKey" in route ? route.nodeKey : undefined,
    order: "order" in route ? route.order : undefined,
    parentPath: "parentPath" in route ? route.parentPath : undefined,
    programKey: "programKey" in route ? route.programKey : undefined,
    publicPath: route.publicPath,
    sectionKey: "sectionKey" in route ? route.sectionKey : undefined,
    sitemap: route.sitemap,
    sourcePath: "sourcePath" in route ? route.sourcePath : undefined,
    title: route.title,
  };
}
