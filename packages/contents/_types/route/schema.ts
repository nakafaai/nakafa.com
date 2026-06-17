import { LocaleSchema } from "@repo/contents/_types/content";
import { MaterialSchema } from "@repo/contents/_types/curriculum/material";
import { MaterialKeySchema } from "@repo/contents/_types/material/schema";
import {
  LearningProgramKeySchema,
  ProgramNavigationLevelSchema,
} from "@repo/contents/_types/program/schema";
import { PublicRoutePathSchema } from "@repo/contents/_types/route/segment";
import { Schema } from "effect";

type SchemaType<T extends Schema.Schema.Any> = Schema.Schema.Type<T>;

const PublicRouteBaseSchema = Schema.Struct({
  description: Schema.optional(Schema.String),
  locale: LocaleSchema,
  parentPath: Schema.optional(PublicRoutePathSchema),
  publicPath: PublicRoutePathSchema,
  sitemap: Schema.Boolean,
  title: Schema.String,
});

export const PUBLIC_ROUTE_KIND_VALUES = [
  "assessment-context",
  "curriculum-context",
  "exercise-question",
  "exercise-set",
  "subject-lesson",
  "subject-topic",
] as const;

export const PublicRouteKindSchema = Schema.Literal(
  ...PUBLIC_ROUTE_KIND_VALUES
);

export type PublicRouteKind = SchemaType<typeof PublicRouteKindSchema>;

export const PublicContentRouteSchema = Schema.extend(
  PublicRouteBaseSchema,
  Schema.Struct({
    kind: Schema.Literal(
      "subject-topic",
      "subject-lesson",
      "exercise-set",
      "exercise-question"
    ),
    materialKey: MaterialKeySchema,
    order: Schema.optional(Schema.Int.pipe(Schema.nonNegative())),
    sectionKey: Schema.optional(Schema.String),
    sourcePath: PublicRoutePathSchema,
  })
);

export type PublicContentRoute = SchemaType<typeof PublicContentRouteSchema>;

export const PublicCurriculumRouteSchema = Schema.extend(
  PublicRouteBaseSchema,
  Schema.Struct({
    canonicalPath: Schema.optional(PublicRoutePathSchema),
    kind: Schema.Literal("curriculum-context"),
    level: ProgramNavigationLevelSchema,
    materialDomain: Schema.optional(MaterialSchema),
    materialKey: Schema.optional(MaterialKeySchema),
    nodeKey: Schema.String,
    order: Schema.Int.pipe(Schema.nonNegative()),
    programKey: LearningProgramKeySchema,
  })
);

export type PublicCurriculumRoute = SchemaType<
  typeof PublicCurriculumRouteSchema
>;

export const PublicAssessmentRouteSchema = Schema.extend(
  PublicRouteBaseSchema,
  Schema.Struct({
    canonicalPath: Schema.optional(PublicRoutePathSchema),
    kind: Schema.Literal("assessment-context"),
    level: ProgramNavigationLevelSchema,
    materialKey: Schema.optional(MaterialKeySchema),
    nodeKey: Schema.String,
    programKey: LearningProgramKeySchema,
  })
);

export type PublicAssessmentRoute = SchemaType<
  typeof PublicAssessmentRouteSchema
>;

export const PublicRouteSchema = Schema.Union(
  PublicContentRouteSchema,
  PublicCurriculumRouteSchema,
  PublicAssessmentRouteSchema
);

export type PublicRoute = SchemaType<typeof PublicRouteSchema>;
