import { LocaleSchema } from "@repo/contents/_types/content";
import { MaterialSchema } from "@repo/contents/_types/curriculum/material";
import { MaterialKeySchema } from "@repo/contents/_types/material/schema";
import {
  LearningProgramKeySchema,
  ProgramNavigationIconKeySchema,
  ProgramNavigationLevelSchema,
} from "@repo/contents/_types/program/schema";
import { PublicRoutePathSchema } from "@repo/contents/_types/route/segment";
import { Schema } from "effect";

type SchemaType<T extends Schema.Schema.Any> = Schema.Schema.Type<T>;

const PublicRouteBaseSchema = Schema.Struct({
  description: Schema.optional(Schema.String),
  locale: LocaleSchema,
  publicPath: PublicRoutePathSchema,
  sitemap: Schema.Boolean,
  title: Schema.String,
});

const PublicRouteOptionalParentSchema = Schema.Struct({
  parentPath: Schema.optional(PublicRoutePathSchema),
});

const PublicRouteParentSchema = Schema.Struct({
  parentPath: PublicRoutePathSchema,
});

const PublicCurriculumRouteBaseSchema = Schema.extend(
  PublicRouteBaseSchema,
  PublicRouteOptionalParentSchema
);

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

const PublicContentRouteBaseSchema = Schema.extend(
  PublicRouteBaseSchema,
  Schema.Struct({
    materialKey: MaterialKeySchema,
    order: Schema.optional(Schema.Int.pipe(Schema.nonNegative())),
    sectionKey: Schema.optional(Schema.String),
    sourcePath: PublicRoutePathSchema,
  })
);

export const PublicContentRouteSchema = Schema.Union(
  Schema.extend(
    PublicContentRouteBaseSchema,
    Schema.Struct({ kind: Schema.Literal("subject-topic") })
  ),
  Schema.extend(
    Schema.extend(PublicContentRouteBaseSchema, PublicRouteParentSchema),
    Schema.Struct({ kind: Schema.Literal("subject-lesson") })
  ),
  Schema.extend(
    Schema.extend(PublicContentRouteBaseSchema, PublicRouteParentSchema),
    Schema.Struct({ kind: Schema.Literal("exercise-set") })
  ),
  Schema.extend(
    Schema.extend(PublicContentRouteBaseSchema, PublicRouteParentSchema),
    Schema.Struct({ kind: Schema.Literal("exercise-question") })
  )
);

export type PublicContentRoute = SchemaType<typeof PublicContentRouteSchema>;

export const PublicCurriculumRouteSchema = Schema.extend(
  PublicCurriculumRouteBaseSchema,
  Schema.Struct({
    canonicalPath: Schema.optional(PublicRoutePathSchema),
    displayGroupIconKey: Schema.optional(ProgramNavigationIconKeySchema),
    displayGroupTitle: Schema.optional(Schema.String),
    iconKey: ProgramNavigationIconKeySchema,
    kind: Schema.Literal("curriculum-context"),
    level: ProgramNavigationLevelSchema,
    materialCardDescription: Schema.optional(Schema.String),
    materialCardTitle: Schema.optional(Schema.String),
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
  Schema.extend(PublicRouteBaseSchema, PublicRouteOptionalParentSchema),
  Schema.Struct({
    canonicalPath: Schema.optional(PublicRoutePathSchema),
    kind: Schema.Literal("assessment-context"),
    level: ProgramNavigationLevelSchema,
    materialKey: Schema.optional(MaterialKeySchema),
    nodeKey: Schema.String,
    order: Schema.Int.pipe(Schema.nonNegative()),
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
