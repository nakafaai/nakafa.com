import { Schema } from "effect";

type SchemaType<T extends Schema.Schema.Any> = Schema.Schema.Type<T>;

const PUBLIC_ROUTE_SEGMENT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PUBLIC_ROUTE_PATH_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

export const PublicRouteSegmentSchema = Schema.String.pipe(
  Schema.pattern(PUBLIC_ROUTE_SEGMENT_PATTERN, {
    identifier: "PublicRouteSegment",
    description: "Lowercase kebab-case public URL segment.",
    message: () => "Invalid public route segment.",
  }),
  Schema.brand("@Nakafa/PublicRouteSegment")
);

export type PublicRouteSegment = SchemaType<typeof PublicRouteSegmentSchema>;

export const PublicRoutePathSchema = Schema.String.pipe(
  Schema.pattern(PUBLIC_ROUTE_PATH_PATTERN, {
    identifier: "PublicRoutePath",
    description:
      "Slash-separated public URL path without locale or leading slash.",
    message: () => "Invalid public route path.",
  }),
  Schema.brand("@Nakafa/PublicRoutePath")
);

export type PublicRoutePath = SchemaType<typeof PublicRoutePathSchema>;

export const PublicRouteSlugMapSchema = Schema.Struct({
  en: PublicRouteSegmentSchema,
  id: PublicRouteSegmentSchema,
});

export type PublicRouteSlugMap = SchemaType<typeof PublicRouteSlugMapSchema>;
