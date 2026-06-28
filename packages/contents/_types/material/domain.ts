import { ExercisesMaterialSchema } from "@repo/contents/_types/assessment/material";
import { MaterialSchema } from "@repo/contents/_types/curriculum/material";
import { PublicRouteSlugMapSchema } from "@repo/contents/_types/route/segment";
import { Schema } from "effect";

type SchemaType<T extends Schema.Schema.Any> = Schema.Schema.Type<T>;

export const MaterialRouteDomainSchema = Schema.Union(
  Schema.Struct({
    domain: MaterialSchema,
    kind: Schema.Literal("lesson"),
    routeSlugs: PublicRouteSlugMapSchema,
  }),
  Schema.Struct({
    domain: ExercisesMaterialSchema,
    kind: Schema.Literal("practice"),
    routeSlugs: PublicRouteSlugMapSchema,
  })
);

export type MaterialRouteDomain = SchemaType<typeof MaterialRouteDomainSchema>;

const materialRouteDomainInput = [
  { domain: "ai-ds", kind: "lesson", routeSlugs: { en: "ai-ds", id: "ai-ds" } },
  {
    domain: "biology",
    kind: "lesson",
    routeSlugs: { en: "biology", id: "biologi" },
  },
  {
    domain: "chemistry",
    kind: "lesson",
    routeSlugs: { en: "chemistry", id: "kimia" },
  },
  {
    domain: "mathematics",
    kind: "lesson",
    routeSlugs: { en: "mathematics", id: "matematika" },
  },
  {
    domain: "physics",
    kind: "lesson",
    routeSlugs: { en: "physics", id: "fisika" },
  },
  {
    domain: "english-language",
    kind: "practice",
    routeSlugs: { en: "english-language", id: "bahasa-inggris" },
  },
  {
    domain: "general-knowledge",
    kind: "practice",
    routeSlugs: { en: "general-knowledge", id: "pengetahuan-umum" },
  },
  {
    domain: "general-reasoning",
    kind: "practice",
    routeSlugs: { en: "general-reasoning", id: "penalaran-umum" },
  },
  {
    domain: "indonesian-language",
    kind: "practice",
    routeSlugs: { en: "indonesian-language", id: "bahasa-indonesia" },
  },
  {
    domain: "mathematical-reasoning",
    kind: "practice",
    routeSlugs: { en: "mathematical-reasoning", id: "penalaran-matematika" },
  },
  {
    domain: "mathematics",
    kind: "practice",
    routeSlugs: { en: "mathematics", id: "matematika" },
  },
  {
    domain: "quantitative-knowledge",
    kind: "practice",
    routeSlugs: { en: "quantitative-knowledge", id: "pengetahuan-kuantitatif" },
  },
  {
    domain: "reading-and-writing-skills",
    kind: "practice",
    routeSlugs: {
      en: "reading-and-writing-skills",
      id: "literasi-membaca-menulis",
    },
  },
];

export const MATERIAL_ROUTE_DOMAINS = Schema.decodeUnknownSync(
  Schema.Array(MaterialRouteDomainSchema)
)(materialRouteDomainInput);
