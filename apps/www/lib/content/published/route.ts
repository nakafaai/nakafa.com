import "server-only";

import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import {
  ContentProjectionSchema,
  familyForProjection,
} from "@nakafa/aksara-contracts/projection/spec";
import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";
import type { ActiveContentReleaseId } from "@/lib/content/published/active";
import {
  PublishedProjectionError,
  PublishedReleaseMismatchError,
} from "@/lib/content/published/errors";
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

type ContentRouteArgs = FunctionArgs<
  typeof api.contentRelease.ownership.resolve
>;
type ContentRouteResult = FunctionReturnType<
  typeof api.contentRelease.ownership.resolve
>;

/** Active identity and route pair that must be read from one publication. */
interface ActiveContentRouteInput extends ContentRouteArgs {
  readonly activeReleaseId: ActiveContentReleaseId | null;
}

/** One active Aksara route selected without exposing executable code. */
type ActiveContentRoute =
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
      readonly projection: typeof ContentProjectionSchema.Type;
    };

/** Reads one exact active public-route projection from Convex. */
function fetchActiveContentRoute(args: ContentRouteArgs) {
  return fetchRuntimeQuery(api.contentRelease.ownership.resolve, args);
}

/** Verifies one found projection against its requested family and route. */
const decodeActiveProjection = Effect.fn(
  "NakafaContent.decodeActiveProjection"
)(function* (
  input: Extract<ContentRouteResult, { readonly kind: "found" }>,
  identity: {
    readonly family: ContentFamily;
    readonly locale: ContentRouteArgs["locale"];
    readonly publicPath: string;
  }
) {
  const parsed = yield* Effect.try({
    catch: () => new PublishedProjectionError(identity),
    try: (): unknown => JSON.parse(input.projectionJson),
  });
  const projection = yield* Schema.decodeUnknown(ContentProjectionSchema)(
    parsed,
    { onExcessProperty: "error" }
  ).pipe(Effect.mapError(() => new PublishedProjectionError(identity)));
  if (
    projection.kind === "question-body" ||
    familyForProjection(projection) !== identity.family ||
    projection.locale !== identity.locale ||
    projection.publicPath !== identity.publicPath
  ) {
    return yield* new PublishedProjectionError(identity);
  }
  return projection;
});

/** Resolves active ownership through one family-agnostic route seam. */
export const readActiveContentRoute = Effect.fn(
  "NakafaContent.readActiveContentRoute"
)(function* (input: ActiveContentRouteInput) {
  if (input.activeReleaseId === null) {
    return {
      activeReleaseId: null,
      kind: "unmanaged",
    } satisfies ActiveContentRoute;
  }

  const args = {
    family: input.family,
    locale: input.locale,
    publicPath: input.publicPath,
  };
  const result = yield* readRuntimeQuery(
    "contentRelease.ownership.resolve",
    () => fetchActiveContentRoute(args)
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

    return { activeReleaseId, kind: result.kind } satisfies ActiveContentRoute;
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
    return { activeReleaseId, kind: result.kind } satisfies ActiveContentRoute;
  }
  const projection = yield* decodeActiveProjection(result, args);

  return {
    activeReleaseId,
    kind: "found",
    projection,
  } satisfies ActiveContentRoute;
});
