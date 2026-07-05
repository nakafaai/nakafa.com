import { Schema } from "effect";

/** Stable learning object kinds supported by graph identity generation. */
export const LEARNING_OBJECT_KIND_VALUES = [
  "article",
  "curriculum-topic",
  "curriculum-lesson",
  "tryout-country",
  "tryout-exam",
  "tryout-set",
  "tryout-section",
  "quran-surah",
] as const;

/** Runtime schema for graph learning object kinds. */
export const LearningObjectKindSchema = Schema.Literal(
  ...LEARNING_OBJECT_KIND_VALUES
);

/** Graph learning object kind derived from the runtime schema. */
export type LearningObjectKind = Schema.Schema.Type<
  typeof LearningObjectKindSchema
>;

/** Stable source roots accepted by the graph source registry adapter. */
export const SOURCE_REGISTRY_ROOT_VALUES = [
  "articles",
  "material",
  "tryout",
  "quran",
] as const;

/** Runtime schema for graph source registry roots. */
export const SourceRegistryRootSchema = Schema.Literal(
  ...SOURCE_REGISTRY_ROOT_VALUES
);

/** Source registry root derived from the runtime schema. */
export type SourceRegistryRoot = Schema.Schema.Type<
  typeof SourceRegistryRootSchema
>;

/** Stable product scopes used to classify graph curriculum lenses. */
export const CURRICULUM_LENS_SCOPE_VALUES = [
  "article-domain",
  "curriculum",
  "exam",
  "scripture",
] as const;

/** Runtime schema for broad graph lens scopes. */
export const CurriculumLensScopeSchema = Schema.Literal(
  ...CURRICULUM_LENS_SCOPE_VALUES
);

/** Curriculum lens scope derived from the runtime schema. */
export type CurriculumLensScope = Schema.Schema.Type<
  typeof CurriculumLensScopeSchema
>;

/** Domain error for source routes that cannot project into graph identity. */
export class InvalidLearningGraphRouteError extends Schema.TaggedError<InvalidLearningGraphRouteError>()(
  "InvalidLearningGraphRouteError",
  {
    kind: Schema.optional(LearningObjectKindSchema),
    message: Schema.String,
    route: Schema.String,
  }
) {}

/** Runtime schema for Quran-specific source route projection metadata. */
export const QuranRouteProjectionSchema = Schema.Struct({
  surahSegment: Schema.String,
});

/** Quran route projection metadata derived from the runtime schema. */
export type QuranRouteProjection = Schema.Schema.Type<
  typeof QuranRouteProjectionSchema
>;

/** Runtime schema for projection drafts before derived root/scope/depth data. */
export const SourceRouteProjectionDraftSchema = Schema.Struct({
  conceptSegments: Schema.Array(Schema.String),
  kind: LearningObjectKindSchema,
  learningObjectSegments: Schema.Array(Schema.String),
  lensSegments: Schema.Array(Schema.String),
  parentRoute: Schema.String,
  quran: Schema.optional(QuranRouteProjectionSchema),
  route: Schema.String,
});

/** Projection draft derived from the runtime schema. */
export type SourceRouteProjectionDraft = Schema.Schema.Type<
  typeof SourceRouteProjectionDraftSchema
>;

/** Runtime schema for adapter metadata derived from one source route projection. */
export const SourceRouteProjectionSchema =
  SourceRouteProjectionDraftSchema.pipe(
    Schema.extend(
      Schema.Struct({
        depth: Schema.Number,
        lensScope: CurriculumLensScopeSchema,
        sourceRoot: SourceRegistryRootSchema,
      })
    )
  );

/** Adapter metadata derived from the runtime schema. */
export type SourceRouteProjection = Schema.Schema.Type<
  typeof SourceRouteProjectionSchema
>;

/** Runtime schema for a source route plus its declared graph object kind. */
export const SourceRouteInputSchema = Schema.Struct({
  kind: LearningObjectKindSchema,
  route: Schema.String,
});

/** Source route input derived from the runtime schema. */
export type SourceRouteInput = Schema.Schema.Type<
  typeof SourceRouteInputSchema
>;

const ROOT_BY_KIND = {
  article: "articles",
  "tryout-country": "tryout",
  "tryout-exam": "tryout",
  "tryout-set": "tryout",
  "tryout-section": "tryout",
  "quran-surah": "quran",
  "curriculum-lesson": "material",
  "curriculum-topic": "material",
} as const satisfies Record<LearningObjectKind, SourceRegistryRoot>;

const LENS_SCOPE_BY_KIND = {
  article: "article-domain",
  "tryout-country": "exam",
  "tryout-exam": "exam",
  "tryout-set": "exam",
  "tryout-section": "exam",
  "quran-surah": "scripture",
  "curriculum-lesson": "curriculum",
  "curriculum-topic": "curriculum",
} as const satisfies Record<LearningObjectKind, CurriculumLensScope>;

/** Returns the source-registry root owned by one graph object kind. */
export function getSourceRegistryRootForKind(kind: LearningObjectKind) {
  return ROOT_BY_KIND[kind];
}

/** Returns the broad curriculum lens scope owned by one graph object kind. */
export function getCurriculumLensScopeForKind(kind: LearningObjectKind) {
  return LENS_SCOPE_BY_KIND[kind];
}
