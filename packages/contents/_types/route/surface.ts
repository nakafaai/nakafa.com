import { LocaleSchema } from "@repo/contents/_types/content";
import {
  PublicRouteSegmentSchema,
  PublicRouteSlugMapSchema,
} from "@repo/contents/_types/route/segment";
import { Schema } from "effect";

type SchemaType<T extends Schema.Schema.Any> = Schema.Schema.Type<T>;

export const PublicRouteSurfaceKeySchema = Schema.Literal(
  "curriculum",
  "subject",
  "tryout"
);

export type PublicRouteSurfaceKey = SchemaType<
  typeof PublicRouteSurfaceKeySchema
>;

export const PublicRouteSurfaceSchema = Schema.Struct({
  appSegment: PublicRouteSegmentSchema,
  key: PublicRouteSurfaceKeySchema,
  routeSlugs: PublicRouteSlugMapSchema,
});

export type PublicRouteSurface = SchemaType<typeof PublicRouteSurfaceSchema>;

const publicRouteSurfaceInput = [
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

export const PublicRouteNamespaceLookupSchema = Schema.Struct({
  locale: LocaleSchema,
  namespace: PublicRouteSurfaceKeySchema,
  segment: PublicRouteSegmentSchema,
});

export type PublicRouteNamespaceLookup = SchemaType<
  typeof PublicRouteNamespaceLookupSchema
>;
