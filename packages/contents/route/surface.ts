import {
  type AppLocaleCode,
  AppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import { Array as Arr, Option, Schema } from "effect";

type SchemaType<T extends Schema.Constraint> = Schema.Schema.Type<T>;
type SchemaEncoded<T extends Schema.Constraint> = Schema.Codec.Encoded<T>;
const PUBLIC_ROUTE_SEGMENT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const PublicRouteSegmentSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(PUBLIC_ROUTE_SEGMENT_PATTERN)),
  Schema.brand("@Nakafa/PublicRouteSegment")
);
const PublicRouteSlugMapSchema = Schema.Record(
  AppLocaleCodeSchema,
  PublicRouteSegmentSchema
);
const PublicRouteSurfaceKeySchema = Schema.Literals([
  "curriculum",
  "subject",
  "tryout",
]);
type PublicRouteSurfaceKey = SchemaType<typeof PublicRouteSurfaceKeySchema>;
const PublicRouteSurfaceSchema = Schema.Struct({
  appSegment: PublicRouteSegmentSchema,
  key: PublicRouteSurfaceKeySchema,
  routeSlugs: PublicRouteSlugMapSchema,
});
export type PublicRouteSurface = SchemaType<typeof PublicRouteSurfaceSchema>;
const publicRouteSurfaceInput = [
  {
    appSegment: "curricula",
    key: "curriculum",
    routeSlugs: {
      de: "lehrplaene",
      en: "curriculum",
      id: "kurikulum",
      ms: "kurikulum",
    },
  },
  {
    appSegment: "materials",
    key: "subject",
    routeSlugs: {
      de: "faecher",
      en: "subjects",
      id: "materi",
      ms: "mata-pelajaran",
    },
  },
  {
    appSegment: "try-out",
    key: "tryout",
    routeSlugs: {
      de: "try-out",
      en: "try-out",
      id: "try-out",
      ms: "try-out",
    },
  },
] as const satisfies readonly SchemaEncoded<typeof PublicRouteSurfaceSchema>[];
/**
 * The route folder of each public surface. The router serves a surface below
 * this segment, and its localized namespace is the address a reader sees.
 */
export type PublicRouteAppSegment =
  (typeof publicRouteSurfaceInput)[number]["appSegment"];
export const PUBLIC_ROUTE_SURFACES = Schema.decodeSync(
  Schema.Array(PublicRouteSurfaceSchema)
)(publicRouteSurfaceInput);
/** Reads the localized URL namespace owned by one Nakafa route surface. */
export function readNamespaceSegment(
  namespace: PublicRouteSurfaceKey,
  locale: AppLocaleCode
) {
  return Option.getOrUndefined(
    Arr.findFirst(PUBLIC_ROUTE_SURFACES, (item) => item.key === namespace)
  )?.routeSlugs[locale];
}
