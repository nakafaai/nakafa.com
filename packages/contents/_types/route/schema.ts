import { ArticleCategorySchema } from "@repo/contents/_types/articles/category";
import { LocaleSchema } from "@repo/contents/_types/content";
import { MaterialSchema } from "@repo/contents/_types/curriculum/material";
import { MaterialKeySchema } from "@repo/contents/_types/material/schema";
import {
  LearningProgramKeySchema,
  ProgramNavigationIconKeySchema,
  ProgramNavigationLevelSchema,
} from "@repo/contents/_types/program/schema";
import { PublicRoutePathSchema } from "@repo/contents/_types/route/segment";
import { TryoutKeySchema } from "@repo/contents/_types/tryout/schema";
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
  "article-category",
  "curriculum-context",
  "subject-lesson",
  "subject-topic",
  "tryout-country",
  "tryout-exam",
  "tryout-section",
  "tryout-set",
  "tryout-track",
] as const;

export const PublicRouteKindSchema = Schema.Literal(
  ...PUBLIC_ROUTE_KIND_VALUES
);

export type PublicRouteKind = SchemaType<typeof PublicRouteKindSchema>;

export const PublicArticleRouteSchema = Schema.extend(
  PublicRouteBaseSchema,
  Schema.Struct({
    category: ArticleCategorySchema,
    kind: Schema.Literal("article-category"),
  })
);

export type PublicArticleRoute = SchemaType<typeof PublicArticleRouteSchema>;

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
    materialContextNodeKey: Schema.optional(Schema.String),
    materialContextParentPath: Schema.optional(PublicRoutePathSchema),
    materialContextPublicPath: Schema.optional(PublicRoutePathSchema),
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

const PublicTryoutRouteBaseSchema = Schema.extend(
  PublicRouteBaseSchema,
  Schema.Struct({
    countryKey: TryoutKeySchema,
    order: Schema.Int.pipe(Schema.nonNegative()),
    sourceRevision: Schema.String,
  })
);

export const PublicTryoutRouteSchema = Schema.Union(
  Schema.extend(
    PublicTryoutRouteBaseSchema,
    Schema.Struct({
      kind: Schema.Literal("tryout-country"),
    })
  ),
  Schema.extend(
    Schema.extend(PublicTryoutRouteBaseSchema, PublicRouteParentSchema),
    Schema.Struct({
      examKey: TryoutKeySchema,
      kind: Schema.Literal("tryout-exam"),
    })
  ),
  Schema.extend(
    Schema.extend(PublicTryoutRouteBaseSchema, PublicRouteParentSchema),
    Schema.Struct({
      examKey: TryoutKeySchema,
      kind: Schema.Literal("tryout-track"),
      trackKey: TryoutKeySchema,
    })
  ),
  Schema.extend(
    Schema.extend(PublicTryoutRouteBaseSchema, PublicRouteParentSchema),
    Schema.Struct({
      examKey: TryoutKeySchema,
      kind: Schema.Literal("tryout-set"),
      setKey: TryoutKeySchema,
      trackKey: TryoutKeySchema,
    })
  ),
  Schema.extend(
    Schema.extend(PublicTryoutRouteBaseSchema, PublicRouteParentSchema),
    Schema.Struct({
      examKey: TryoutKeySchema,
      kind: Schema.Literal("tryout-section"),
      sectionKey: TryoutKeySchema,
      setKey: TryoutKeySchema,
      trackKey: TryoutKeySchema,
    })
  )
);

export type PublicTryoutRoute = SchemaType<typeof PublicTryoutRouteSchema>;

export const PublicRouteSchema = Schema.Union(
  PublicArticleRouteSchema,
  PublicContentRouteSchema,
  PublicCurriculumRouteSchema,
  PublicTryoutRouteSchema
);

export type PublicRoute = SchemaType<typeof PublicRouteSchema>;
