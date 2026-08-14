import type { Locale } from "@repo/contents/_types/content";
import { fieldsForEveryLocale } from "@repo/utilities/locales";
import { Schema } from "effect";

type SchemaType<T extends Schema.Schema.Any> = Schema.Schema.Type<T>;
type SchemaEncoded<T extends Schema.Schema.Any> = Schema.Schema.Encoded<T>;

const PUBLIC_ROUTE_SEGMENT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const PublicRouteSegmentSchema = Schema.String.pipe(
  Schema.pattern(PUBLIC_ROUTE_SEGMENT_PATTERN),
  Schema.brand("@Nakafa/PublicRouteSegment")
);

const PublicRouteSlugMapSchema = Schema.Struct(
  fieldsForEveryLocale(PublicRouteSegmentSchema)
);

const PublicRouteSurfaceKeySchema = Schema.Literal(
  "curriculum",
  "subject",
  "tryout"
);

export type PublicRouteSurfaceKey = SchemaType<
  typeof PublicRouteSurfaceKeySchema
>;

const PublicRouteSurfaceSchema = Schema.Struct({
  appSegment: PublicRouteSegmentSchema,
  key: PublicRouteSurfaceKeySchema,
  routeSlugs: PublicRouteSlugMapSchema,
});

export type PublicRouteSurface = SchemaType<typeof PublicRouteSurfaceSchema>;

const publicRouteSurfaceInput: readonly SchemaEncoded<
  typeof PublicRouteSurfaceSchema
>[] = [
  {
    appSegment: "curricula",
    key: "curriculum",
    routeSlugs: { en: "curriculum", id: "kurikulum" },
  },
  {
    appSegment: "materials",
    key: "subject",
    routeSlugs: { en: "subjects", id: "materi" },
  },
  {
    appSegment: "try-out",
    key: "tryout",
    routeSlugs: { en: "try-out", id: "try-out" },
  },
];

export const PUBLIC_ROUTE_SURFACES = Schema.decodeUnknownSync(
  Schema.Array(PublicRouteSurfaceSchema)
)(publicRouteSurfaceInput);

/** Reads the localized URL namespace owned by one Nakafa route surface. */
export function readNamespaceSegment(
  namespace: PublicRouteSurfaceKey,
  locale: Locale
) {
  return PUBLIC_ROUTE_SURFACES.find((item) => item.key === namespace)
    ?.routeSlugs[locale];
}
