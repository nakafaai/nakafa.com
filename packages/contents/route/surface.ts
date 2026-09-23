import {
  type AppLocaleCode,
  AppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import { Schema } from "effect";

type SchemaType<T extends Schema.Constraint> = Schema.Schema.Type<T>;
type SchemaEncoded<T extends Schema.Constraint> = Schema.Codec.Encoded<T>;
const PUBLIC_ROUTE_SEGMENT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
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
    routeSlugs: { de: "lehrplaene", en: "curriculum", id: "kurikulum" },
  },
  {
    appSegment: "materials",
    key: "subject",
    routeSlugs: { de: "faecher", en: "subjects", id: "materi" },
  },
  {
    appSegment: "try-out",
    key: "tryout",
    routeSlugs: { de: "try-out", en: "try-out", id: "try-out" },
  },
];
export const PUBLIC_ROUTE_SURFACES = Schema.decodeSync(
  Schema.Array(PublicRouteSurfaceSchema)
)(publicRouteSurfaceInput);
/** Reads the localized URL namespace owned by one Nakafa route surface. */
export function readNamespaceSegment(
  namespace: PublicRouteSurfaceKey,
  locale: AppLocaleCode
) {
  return PUBLIC_ROUTE_SURFACES.find((item) => item.key === namespace)
    ?.routeSlugs[locale];
}
