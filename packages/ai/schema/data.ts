import { NakafaAgentExerciseOptionsSchema } from "@repo/contents/_lib/agent/schema/exercise";
import { NakafaAgentQuranReferenceOptionsSchema } from "@repo/contents/_lib/agent/schema/quran";
import { NakafaAgentReadOptionsSchema } from "@repo/contents/_lib/agent/schema/read";
import {
  NakafaAgentContentRefSchema,
  NakafaAgentContentSummarySchema,
  NakafaAgentSectionSchema,
} from "@repo/contents/_lib/agent/schema/ref";
import {
  NakafaAgentSearchOptionsSchema,
  NakafaAgentSearchResultSchema,
} from "@repo/contents/_lib/agent/schema/search";
import { NakafaAgentTaxonomyOptionsSchema } from "@repo/contents/_lib/agent/schema/taxonomy";
import {
  MAX_COORDINATE_ARTIFACT_BYTES,
  MAX_COORDINATE_ARTIFACT_PRIMITIVES,
  MAX_LEARNING_ARTIFACT_ID_LENGTH,
} from "@repo/math/schema/artifact/safety";
import { COORDINATE_SYSTEM_ARTIFACT_KIND } from "@repo/math/schema/artifact/schema";
import { MAX_MATH_AST_DISPLAY_LENGTH } from "@repo/math/schema/ast/schema";
import { MathDataSchema } from "@repo/math/schema/data";
import { locales } from "@repo/utilities/locales";
import { Schema } from "effect";

const LocaleSchema = Schema.Literal(...locales);
const StatusSchema = Schema.Literal("loading", "done", "error");

const ContentSummarySchema = NakafaAgentContentSummarySchema;
const SearchInputSchema = NakafaAgentSearchOptionsSchema;
const SearchResultSchema = NakafaAgentSearchResultSchema;
const ReadInputSchema = NakafaAgentReadOptionsSchema;
const ExerciseInputSchema = NakafaAgentExerciseOptionsSchema;
const QuranInputSchema = NakafaAgentQuranReferenceOptionsSchema;
const TaxonomyInputSchema = NakafaAgentTaxonomyOptionsSchema;
const LearningArtifactManifestTitleSchema = Schema.NonEmptyString.pipe(
  Schema.maxLength(180)
);
const LearningArtifactManifestDescriptionSchema = Schema.String.pipe(
  Schema.maxLength(500)
);
const LearningArtifactManifestScalarSchema = Schema.String.pipe(
  Schema.maxLength(MAX_MATH_AST_DISPLAY_LENGTH)
);

const LearningArtifactManifestAxisBoundsSchema = Schema.Struct({
  max: LearningArtifactManifestScalarSchema,
  min: LearningArtifactManifestScalarSchema,
}).pipe(Schema.mutable);

/** Lightweight chat transcript pointer to a durable learning artifact payload. */
export const LearningArtifactManifestSchema = Schema.Struct({
  artifactId: Schema.NonEmptyString.pipe(
    Schema.pattern(/\S/),
    Schema.maxLength(MAX_LEARNING_ARTIFACT_ID_LENGTH)
  ),
  bounds: Schema.Struct({
    x: LearningArtifactManifestAxisBoundsSchema,
    y: LearningArtifactManifestAxisBoundsSchema,
    z: LearningArtifactManifestAxisBoundsSchema,
  }).pipe(Schema.mutable),
  description: Schema.optional(LearningArtifactManifestDescriptionSchema),
  kind: Schema.Literal(COORDINATE_SYSTEM_ARTIFACT_KIND),
  payloadBytes: Schema.Number.pipe(
    Schema.int(),
    Schema.between(1, MAX_COORDINATE_ARTIFACT_BYTES)
  ),
  primitiveCount: Schema.Number.pipe(
    Schema.int(),
    Schema.between(1, MAX_COORDINATE_ARTIFACT_PRIMITIVES)
  ),
  schemaVersion: Schema.Literal(1),
  title: LearningArtifactManifestTitleSchema,
}).pipe(Schema.mutable);

const ExercisePreviewSchema = NakafaAgentContentRefSchema.pipe(
  Schema.extend(
    Schema.Struct({
      count: Schema.Number,
      exercise_number: Schema.optional(Schema.Number),
      numbers: Schema.Array(Schema.Number).pipe(Schema.mutable),
      title: Schema.String,
    })
  ),
  Schema.mutable
);

const QuranPreviewSchema = NakafaAgentContentRefSchema.pipe(
  Schema.extend(
    Schema.Struct({
      from_verse: Schema.Number,
      name: Schema.String,
      revelation: Schema.String,
      to_verse: Schema.Number,
      translation: Schema.String,
      verse_count: Schema.Number,
    })
  ),
  Schema.mutable
);

const TaxonomyPreviewSchema = Schema.Struct({
  content_counts: Schema.Array(
    Schema.Struct({
      count: Schema.Number,
      locale: LocaleSchema,
    }).pipe(Schema.mutable)
  ).pipe(Schema.mutable),
  locale: LocaleSchema,
  sections: Schema.Array(NakafaAgentSectionSchema).pipe(Schema.mutable),
  tools: Schema.Array(Schema.String).pipe(Schema.mutable),
}).pipe(Schema.mutable);

const nakafaSearchLoadingFields = {
  input: SearchInputSchema,
  kind: Schema.Literal("search"),
  status: Schema.Literal("loading"),
};

const NakafaSearchLoadingSchema = Schema.Struct(nakafaSearchLoadingFields).pipe(
  Schema.mutable
);

const NakafaSearchDoneSchema = Schema.Struct({
  ...nakafaSearchLoadingFields,
  result: SearchResultSchema,
  status: Schema.Literal("done"),
}).pipe(Schema.mutable);

const NakafaSearchErrorSchema = Schema.Struct({
  ...nakafaSearchLoadingFields,
  error: Schema.String,
  status: Schema.Literal("error"),
}).pipe(Schema.mutable);

const nakafaContentLoadingFields = {
  input: ReadInputSchema,
  kind: Schema.Literal("content"),
  status: Schema.Literal("loading"),
};

const NakafaContentLoadingSchema = Schema.Struct(
  nakafaContentLoadingFields
).pipe(Schema.mutable);

const NakafaContentDoneSchema = Schema.Struct({
  ...nakafaContentLoadingFields,
  result: ContentSummarySchema,
  status: Schema.Literal("done"),
}).pipe(Schema.mutable);

const NakafaContentErrorSchema = Schema.Struct({
  ...nakafaContentLoadingFields,
  error: Schema.String,
  status: Schema.Literal("error"),
}).pipe(Schema.mutable);

const nakafaExerciseLoadingFields = {
  input: ExerciseInputSchema,
  kind: Schema.Literal("exercise"),
  status: Schema.Literal("loading"),
};

const NakafaExerciseLoadingSchema = Schema.Struct(
  nakafaExerciseLoadingFields
).pipe(Schema.mutable);

const NakafaExerciseDoneSchema = Schema.Struct({
  ...nakafaExerciseLoadingFields,
  result: ExercisePreviewSchema,
  status: Schema.Literal("done"),
}).pipe(Schema.mutable);

const NakafaExerciseErrorSchema = Schema.Struct({
  ...nakafaExerciseLoadingFields,
  error: Schema.String,
  status: Schema.Literal("error"),
}).pipe(Schema.mutable);

const nakafaQuranLoadingFields = {
  input: QuranInputSchema,
  kind: Schema.Literal("quran"),
  status: Schema.Literal("loading"),
};

const NakafaQuranLoadingSchema = Schema.Struct(nakafaQuranLoadingFields).pipe(
  Schema.mutable
);

const NakafaQuranDoneSchema = Schema.Struct({
  ...nakafaQuranLoadingFields,
  result: QuranPreviewSchema,
  status: Schema.Literal("done"),
}).pipe(Schema.mutable);

const NakafaQuranErrorSchema = Schema.Struct({
  ...nakafaQuranLoadingFields,
  error: Schema.String,
  status: Schema.Literal("error"),
}).pipe(Schema.mutable);

const nakafaTaxonomyLoadingFields = {
  input: TaxonomyInputSchema,
  kind: Schema.Literal("taxonomy"),
  status: Schema.Literal("loading"),
};

const NakafaTaxonomyLoadingSchema = Schema.Struct(
  nakafaTaxonomyLoadingFields
).pipe(Schema.mutable);

const NakafaTaxonomyDoneSchema = Schema.Struct({
  ...nakafaTaxonomyLoadingFields,
  result: TaxonomyPreviewSchema,
  status: Schema.Literal("done"),
}).pipe(Schema.mutable);

const NakafaTaxonomyErrorSchema = Schema.Struct({
  ...nakafaTaxonomyLoadingFields,
  error: Schema.String,
  status: Schema.Literal("error"),
}).pipe(Schema.mutable);

/**
 * UI data payloads written by Nakafa sub-tools.
 */
export const NakafaDataSchema = Schema.Union(
  NakafaSearchLoadingSchema,
  NakafaSearchDoneSchema,
  NakafaSearchErrorSchema,
  NakafaContentLoadingSchema,
  NakafaContentDoneSchema,
  NakafaContentErrorSchema,
  NakafaExerciseLoadingSchema,
  NakafaExerciseDoneSchema,
  NakafaExerciseErrorSchema,
  NakafaQuranLoadingSchema,
  NakafaQuranDoneSchema,
  NakafaQuranErrorSchema,
  NakafaTaxonomyLoadingSchema,
  NakafaTaxonomyDoneSchema,
  NakafaTaxonomyErrorSchema
);

/**
 * UI data parts written by Nina agents.
 */
export const DataPartSchema = Schema.Struct({
  artifact: LearningArtifactManifestSchema,
  math: MathDataSchema,
  nakafa: NakafaDataSchema,
  "scrape-url": Schema.Struct({
    content: Schema.String,
    description: Schema.optional(Schema.String),
    error: Schema.optional(Schema.String),
    favicon: Schema.optional(Schema.String),
    status: StatusSchema,
    title: Schema.optional(Schema.String),
    url: Schema.String,
  }).pipe(Schema.mutable),
  suggestions: Schema.Struct({
    data: Schema.Array(Schema.String).pipe(Schema.mutable),
  }).pipe(Schema.mutable),
  "web-search": Schema.Struct({
    error: Schema.optional(Schema.String),
    provider: Schema.optional(Schema.Literal("firecrawl", "google")),
    queries: Schema.Array(Schema.String).pipe(Schema.mutable),
    sources: Schema.Array(
      Schema.Struct({
        citation: Schema.String,
        content: Schema.String,
        description: Schema.String,
        title: Schema.String,
        url: Schema.String,
      }).pipe(Schema.mutable)
    ).pipe(Schema.mutable),
    status: StatusSchema,
  }).pipe(Schema.mutable),
}).pipe(Schema.mutable);

export type DataPart = Schema.Schema.Type<typeof DataPartSchema>;
export type LearningArtifactManifest = Schema.Schema.Type<
  typeof LearningArtifactManifestSchema
>;
export type NakafaDataPart = Schema.Schema.Type<typeof NakafaDataSchema>;
