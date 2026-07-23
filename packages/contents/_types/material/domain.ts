import { MaterialSchema } from "@repo/contents/_types/curriculum/material";
import { PublicRouteSlugMapSchema } from "@repo/contents/_types/route/segment";
import { materialSegments } from "@repo/internationalization/src/segments";
import { Schema } from "effect";

type SchemaType<T extends Schema.Schema.Any> = Schema.Schema.Type<T>;
type SchemaEncoded<T extends Schema.Schema.Any> = Schema.Schema.Encoded<T>;

export const MaterialRouteDomainSchema = Schema.Struct({
  domain: MaterialSchema,
  kind: Schema.Literal("lesson"),
  routeSlugs: PublicRouteSlugMapSchema,
});

export type MaterialRouteDomain = SchemaType<typeof MaterialRouteDomainSchema>;

const materialRouteDomainInput: readonly SchemaEncoded<
  typeof MaterialRouteDomainSchema
>[] = [
  { domain: "ai-ds", kind: "lesson", routeSlugs: { en: "ai-ds", id: "ai-ds" } },
  {
    domain: "biology",
    kind: "lesson",
    routeSlugs: { en: "biology", id: "biologi" },
  },
  {
    domain: "chemistry",
    kind: "lesson",
    routeSlugs: {
      en: materialSegments.en.chemistry,
      id: materialSegments.id.chemistry,
    },
  },
  {
    domain: "mathematics",
    kind: "lesson",
    routeSlugs: {
      en: materialSegments.en.mathematics,
      id: materialSegments.id.mathematics,
    },
  },
  {
    domain: "physics",
    kind: "lesson",
    routeSlugs: { en: "physics", id: "fisika" },
  },
];

export const MATERIAL_ROUTE_DOMAINS = Schema.decodeUnknownSync(
  Schema.Array(MaterialRouteDomainSchema)
)(materialRouteDomainInput);
