import { Schema } from "effect";

const mutableStringArray = Schema.Array(Schema.String).pipe(Schema.mutable);

/** Returns whether one manifest route is a safe absolute public route. */
function isSafeManifestRoute(value: string) {
  if (value === "/") {
    return true;
  }

  if (!value.startsWith("/")) {
    return false;
  }

  return value
    .slice(1)
    .split("/")
    .every(
      (segment) => segment.length > 0 && segment !== "." && segment !== ".."
    );
}

export const ContentManifestRouteSchema = Schema.String.pipe(
  Schema.filter(isSafeManifestRoute, {
    message: () => "Expected a safe absolute content manifest route.",
  }),
  Schema.brand("@Nakafa/ContentManifestRoute")
);

const ContentManifestRouteArraySchema = Schema.Array(
  ContentManifestRouteSchema
).pipe(Schema.mutable);

const LocaleSlugEntrySchema = Schema.Struct({
  locale: Schema.String,
  slugs: mutableStringArray,
}).pipe(Schema.mutable);

const ContentPathCandidateSchema = Schema.Struct({
  fullPath: Schema.String,
  slugParts: mutableStringArray,
}).pipe(Schema.mutable);

const ContentManifestStaticParamSchema = Schema.Struct({
  locale: Schema.String,
  slug: mutableStringArray,
}).pipe(Schema.mutable);

const ContentManifestRedirectsSchema = Schema.Array(
  Schema.Tuple(ContentManifestRouteSchema, ContentManifestRouteSchema)
).pipe(Schema.mutable);

export const ContentRouteManifestSchema = Schema.Struct({
  version: Schema.Number,
  contentRoutes: ContentManifestRouteArraySchema,
  exerciseApiParams: Schema.Array(ContentManifestStaticParamSchema).pipe(
    Schema.mutable
  ),
  localeParams: Schema.Array(ContentManifestStaticParamSchema).pipe(
    Schema.mutable
  ),
  publicRequestRoutes: ContentManifestRouteArraySchema,
  quranRoutes: ContentManifestRouteArraySchema,
  redirects: ContentManifestRedirectsSchema,
  routeRoots: ContentManifestRouteArraySchema,
  staticParams: Schema.Struct({
    articles: Schema.Array(ContentManifestStaticParamSchema).pipe(
      Schema.mutable
    ),
    material: Schema.Array(ContentManifestStaticParamSchema).pipe(
      Schema.mutable
    ),
  }).pipe(Schema.mutable),
}).pipe(Schema.mutable);

const ContentRouteParamManifestSchema = Schema.Struct({
  version: Schema.Number,
  exerciseApiParams: Schema.Array(ContentManifestStaticParamSchema).pipe(
    Schema.mutable
  ),
  localeParams: Schema.Array(ContentManifestStaticParamSchema).pipe(
    Schema.mutable
  ),
  staticParams: Schema.Struct({
    articles: Schema.Array(ContentManifestStaticParamSchema).pipe(
      Schema.mutable
    ),
    material: Schema.Array(ContentManifestStaticParamSchema).pipe(
      Schema.mutable
    ),
  }).pipe(Schema.mutable),
}).pipe(Schema.mutable);

const ContentStaticParamManifestSchema = Schema.Struct({
  version: Schema.Number,
  localeParams: Schema.Array(ContentManifestStaticParamSchema).pipe(
    Schema.mutable
  ),
  staticParams: Schema.Struct({
    articles: Schema.Array(ContentManifestStaticParamSchema).pipe(
      Schema.mutable
    ),
    material: Schema.Array(ContentManifestStaticParamSchema).pipe(
      Schema.mutable
    ),
  }).pipe(Schema.mutable),
}).pipe(Schema.mutable);

export const ContentPublicRouteManifestSchema = Schema.Struct({
  version: Schema.Number,
  contentRoutes: ContentManifestRouteArraySchema,
  publicRequestRoutes: ContentManifestRouteArraySchema,
  quranRoutes: ContentManifestRouteArraySchema,
  redirects: ContentManifestRedirectsSchema,
  routeRoots: ContentManifestRouteArraySchema,
}).pipe(Schema.mutable);

/** Error emitted when manifest output violates the public route schema. */
export class ContentRouteManifestDecodeError extends Schema.TaggedError<ContentRouteManifestDecodeError>()(
  "ContentRouteManifestDecodeError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

export type ContentManifestRoute = Schema.Schema.Type<
  typeof ContentManifestRouteSchema
>;
export type ContentManifestStaticParam = Schema.Schema.Type<
  typeof ContentManifestStaticParamSchema
>;
export type ContentPathCandidate = Schema.Schema.Type<
  typeof ContentPathCandidateSchema
>;
export type LocaleSlugEntry = Schema.Schema.Type<typeof LocaleSlugEntrySchema>;
export type ContentRouteManifest = Schema.Schema.Type<
  typeof ContentRouteManifestSchema
>;
export type ContentRouteParamManifest = Schema.Schema.Type<
  typeof ContentRouteParamManifestSchema
>;
export type ContentPublicRouteManifest = Schema.Schema.Type<
  typeof ContentPublicRouteManifestSchema
>;
export type ContentStaticParamManifest = Schema.Schema.Type<
  typeof ContentStaticParamManifestSchema
>;
