import "server-only";

import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { api } from "@repo/backend/convex/_generated/api";
import type { PublicContentRoute } from "@repo/contents/_types/route/schema";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";
import type { ActiveContentReleaseId } from "@/lib/content/published/active";
import {
  PublishedProjectionError,
  PublishedReleaseMismatchError,
} from "@/lib/content/published/errors";
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

/** Active identity and route pair that must be read from one publication. */
interface ActiveMaterialRouteInput extends MaterialRouteArgs {
  readonly activeReleaseId: ActiveContentReleaseId | null;
}

/** One active Aksara route adapted to Nakafa's current material shell. */
type ActiveMaterialRoute =
  | {
      readonly activeReleaseId: ActiveContentReleaseId | null;
      readonly kind: "unmanaged";
    }
  | {
      readonly activeReleaseId: ActiveContentReleaseId;
      readonly kind: "missing";
    }
  | {
      readonly activeReleaseId: ActiveContentReleaseId;
      readonly kind: "found";
      readonly rendererDomain: Extract<
        MaterialRouteResult,
        { readonly kind: "found" }
      >["rendererDomain"];
      readonly route: PublicContentRoute;
    };

/** Reads one exact active material-route projection from Convex. */
function fetchActiveMaterialRoute(args: MaterialRouteArgs) {
  return fetchRuntimeQuery(api.contentRelease.material.resolve, args);
}

/** Resolves active ownership without reading or exposing executable code. */
export const readActiveMaterialRoute = Effect.fn(
  "NakafaContent.readActiveMaterialRoute"
)(function* (input: ActiveMaterialRouteInput) {
  if (input.activeReleaseId === null) {
    return {
      activeReleaseId: null,
      kind: "unmanaged",
    } satisfies ActiveMaterialRoute;
  }

  const args = { locale: input.locale, publicPath: input.publicPath };
  const result = yield* readRuntimeQuery(
    "contentRelease.material.resolve",
    () => fetchActiveMaterialRoute(args)
  );
  if (result.kind === "unmanaged") {
    const activeReleaseId = yield* Schema.decodeUnknown(
      Schema.NullOr(ReleaseIdSchema)
    )(result.activeReleaseId);
    if (activeReleaseId !== input.activeReleaseId) {
      return yield* new PublishedReleaseMismatchError({
        actualReleaseId: activeReleaseId,
        expectedReleaseId: input.activeReleaseId,
      });
    }

    return { activeReleaseId, kind: result.kind } satisfies ActiveMaterialRoute;
  }

  const activeReleaseId = yield* Schema.decodeUnknown(ReleaseIdSchema)(
    result.activeReleaseId
  );
  if (activeReleaseId !== input.activeReleaseId) {
    return yield* new PublishedReleaseMismatchError({
      actualReleaseId: activeReleaseId,
      expectedReleaseId: input.activeReleaseId,
    });
  }
  if (result.kind === "missing") {
    return { activeReleaseId, kind: result.kind } satisfies ActiveMaterialRoute;
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
    activeReleaseId,
    kind: "found",
    rendererDomain: result.rendererDomain,
    route,
  } satisfies ActiveMaterialRoute;
});
