import "server-only";

import { api } from "@repo/backend/convex/_generated/api";
import type { PublicContentRoute } from "@repo/contents/_types/route/schema";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Effect } from "effect";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { decodePublishedMaterial } from "@/lib/content/published/projection";
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

type MaterialRouteArgs = FunctionArgs<
  typeof api.contentRelease.material.resolve
>;
type MaterialRouteResult = FunctionReturnType<
  typeof api.contentRelease.material.resolve
>;

/** One active Aksara route adapted to Nakafa's current material shell. */
type ActiveMaterialRoute =
  | Exclude<MaterialRouteResult, { readonly kind: "found" }>
  | (Omit<
      Extract<MaterialRouteResult, { readonly kind: "found" }>,
      "projectionJson"
    > & {
      readonly route: PublicContentRoute;
    });

/** Reads one exact active material-route projection from Convex. */
function fetchActiveMaterialRoute(args: MaterialRouteArgs) {
  return fetchRuntimeQuery(api.contentRelease.material.resolve, args);
}

/** Resolves active ownership without reading or exposing executable code. */
export const readActiveMaterialRoute = Effect.fn(
  "NakafaContent.readActiveMaterialRoute"
)(function* (args: MaterialRouteArgs) {
  const result = yield* readRuntimeQuery(
    "contentRelease.material.resolve",
    () => fetchActiveMaterialRoute(args)
  );
  if (result.kind !== "found") {
    return result;
  }
  const projectionInput = yield* Effect.try({
    catch: () =>
      new PublishedProjectionError({
        locale: args.locale,
        publicPath: args.publicPath,
      }),
    try: (): unknown => JSON.parse(result.projectionJson),
  });
  const { route } = yield* decodePublishedMaterial(projectionInput, args);

  return {
    activeReleaseId: result.activeReleaseId,
    kind: "found",
    rendererDomain: result.rendererDomain,
    route,
  } satisfies ActiveMaterialRoute;
});
