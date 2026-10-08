import type { Ref } from "@confect/core";
import { HttpClient } from "@confect/js";
import "server-only";
import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import {
  type AppLocale,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  familyForProjection,
  RoutedContentProjectionSchema,
} from "@nakafa/aksara-contracts/projection/spec";
import refs from "@repo/backend/confect/_generated/refs";
import { Effect, Schema } from "effect";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { httpLayer } from "@/lib/convex/http";

type ContentRouteArgs = Ref.Args<
  typeof refs.public.contentRelease.ownership.resolve
>;
type ContentRouteResult = Ref.Returns<
  typeof refs.public.contentRelease.ownership.resolve
>;
/** One active Aksara route selected without exposing executable code. */
const ActiveContentRouteSchema = Schema.Union([
  Schema.Struct({
    activeReleaseId: Schema.NullOr(ReleaseIdSchema),
    kind: Schema.Literal("unmanaged"),
  }),
  Schema.Struct({
    activeReleaseId: ReleaseIdSchema,
    kind: Schema.Literal("missing"),
  }),
  Schema.Struct({
    activeReleaseId: ReleaseIdSchema,
    kind: Schema.Literal("found"),
    projection: RoutedContentProjectionSchema,
  }),
]);
type ActiveContentRoute = typeof ActiveContentRouteSchema.Type;
/** Verifies one found projection against its requested family and route. */
const decodeActiveProjection = Effect.fn(
  "NakafaContent.decodeActiveProjection"
)(function* (
  input: Extract<
    ContentRouteResult,
    {
      readonly kind: "found";
    }
  >,
  identity: {
    readonly family: ContentFamily;
    readonly appLocale: AppLocale;
    readonly publicPath: string;
  }
) {
  const projection = yield* Schema.decodeEffect(
    Schema.fromJsonString(RoutedContentProjectionSchema)
  )(input.projectionJson, {
    onExcessProperty: "error",
  }).pipe(Effect.mapError(() => new PublishedProjectionError(identity)));
  if (
    familyForProjection(projection) !== identity.family ||
    projection.appLocale !== identity.appLocale ||
    projection.publicPath !== identity.publicPath
  ) {
    return yield* new PublishedProjectionError(identity);
  }
  return projection;
});
/** Resolves ownership and its active release identity in one Convex query. */
export const readActiveContentRoute = Effect.fn(
  "NakafaContent.readActiveContentRoute"
)(function* (input: ContentRouteArgs) {
  const appLocale = AppLocaleSchema.make(input.appLocale);
  const args = {
    appLocale,
    family: input.family,
    publicPath: input.publicPath,
  };
  const result = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(refs.public.contentRelease.ownership.resolve, args)
  ).pipe(Effect.provide(httpLayer()));
  if (result.kind === "unmanaged") {
    const activeReleaseId = yield* Schema.decodeEffect(
      Schema.NullOr(ReleaseIdSchema)
    )(result.activeReleaseId);
    return {
      activeReleaseId,
      kind: result.kind,
    } satisfies ActiveContentRoute;
  }
  const activeReleaseId = yield* Schema.decodeEffect(ReleaseIdSchema)(
    result.activeReleaseId
  );
  if (result.kind === "missing") {
    return {
      activeReleaseId,
      kind: result.kind,
    } satisfies ActiveContentRoute;
  }
  const projection = yield* decodeActiveProjection(result, args);
  return {
    activeReleaseId,
    kind: "found",
    projection,
  } satisfies ActiveContentRoute;
});
