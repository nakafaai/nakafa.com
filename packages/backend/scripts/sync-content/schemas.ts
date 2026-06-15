import type { Id, TableNames } from "@repo/backend/convex/_generated/dataModel";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import {
  CONTENT_ROUTE_KINDS,
  NAKAFA_CONTENT_SECTIONS,
} from "@repo/backend/convex/contents/constants";
import { CONTENT_TYPE_VALUES } from "@repo/backend/convex/lib/validators/contents";
import { locales } from "@repo/utilities/locales";
import { Effect, Schema } from "effect";

const SyncLocaleSchema = Schema.Literal(...locales);
const SyncSectionSchema = Schema.Literal(...NAKAFA_CONTENT_SECTIONS);
const ContentRouteKindSchema = Schema.Literal(...CONTENT_ROUTE_KINDS);
const ContentTypeSchema = Schema.Literal(...CONTENT_TYPE_VALUES);

/** Validates a Convex document ID while preserving its generated table brand. */
export const ConvexIdSchema = <const TableName extends TableNames>(
  tableName: TableName
) =>
  Schema.String.pipe(
    Schema.filter((value): value is Id<TableName> => value.length > 0, {
      message: () => `Expected ${tableName} document ID`,
    })
  );

const ContentIdSchema = Schema.Union(
  ConvexIdSchema("articleContents"),
  ConvexIdSchema("subjectSections"),
  ConvexIdSchema("exerciseQuestions")
);

/** Builds a decoded mutable array schema for generated Convex return types. */
export const mutableArraySchema = <A, I>(schema: Schema.Schema<A, I, never>) =>
  Schema.mutable(Schema.Array(schema));

export const BATCH_SIZES = {
  articles: CONTENT_SYNC_BATCH_LIMITS.articles,
  authors: CONTENT_SYNC_BATCH_LIMITS.authors,
  subjectTopics: CONTENT_SYNC_BATCH_LIMITS.subjectTopics,
  subjectSections: CONTENT_SYNC_BATCH_LIMITS.subjectSections,
  exerciseSets: CONTENT_SYNC_BATCH_LIMITS.exerciseSets,
  exerciseQuestions: CONTENT_SYNC_BATCH_LIMITS.exerciseQuestions,
  quranSurahs: CONTENT_SYNC_BATCH_LIMITS.quranSurahs,
  quranVerses: CONTENT_SYNC_BATCH_LIMITS.quranVerses,
  quranSearchDocuments: CONTENT_SYNC_BATCH_LIMITS.quranSearchDocuments,
  staleArticles: CONTENT_SYNC_BATCH_LIMITS.staleArticles,
  staleSubjectTopics: CONTENT_SYNC_BATCH_LIMITS.staleSubjectTopics,
  staleSubjectSections: CONTENT_SYNC_BATCH_LIMITS.staleSubjectSections,
  staleExerciseSets: CONTENT_SYNC_BATCH_LIMITS.staleExerciseSets,
  staleExerciseQuestions: CONTENT_SYNC_BATCH_LIMITS.staleExerciseQuestions,
  unusedAuthors: CONTENT_SYNC_BATCH_LIMITS.unusedAuthors,
} as const;

/** Identifies an unsupported locale segment while parsing script inputs. */
export class SyncLocaleParseError extends Schema.TaggedError<SyncLocaleParseError>()(
  "SyncLocaleParseError",
  {
    message: Schema.String,
  }
) {}

/** Parses one CLI locale flag into the supported Convex content locale. */
export const parseLocale = Effect.fn("sync.parseLocale")(function* (
  value: string,
  context: string
) {
  return yield* Schema.decodeUnknown(SyncLocaleSchema)(value).pipe(
    Effect.mapError(
      () =>
        new SyncLocaleParseError({
          message: `Invalid locale "${value}" in ${context}. Expected: ${locales.join(", ")}`,
        })
    )
  );
});

export const SyncStateSchema = Schema.Struct({
  lastSyncTimestamp: Schema.Number,
  lastSyncCommit: Schema.String,
});

export const ConvexAuthConfigSchema = Schema.Struct({
  accessToken: Schema.optional(Schema.String),
});

export const ConvexResponseSchema = Schema.Struct({
  status: Schema.Literal("success", "error"),
  value: Schema.optional(Schema.Unknown),
  errorMessage: Schema.optional(Schema.String),
  logLines: Schema.optional(Schema.Array(Schema.String)),
});

export const SyncSummarySchema = Schema.Struct({
  created: Schema.Number,
  updated: Schema.Number,
  unchanged: Schema.Number,
});

export const ArticleSyncResultSchema = Schema.Struct({
  authorLinksCreated: Schema.Number,
  created: Schema.Number,
  referencesCreated: Schema.Number,
  unchanged: Schema.Number,
  updated: Schema.Number,
});

export const SubjectSectionSyncResultSchema = Schema.mutable(
  Schema.Struct({
    authorLinksCreated: Schema.Number,
    created: Schema.Number,
    skipped: Schema.Number,
    skippedTopicSlugs: mutableArraySchema(Schema.String),
    unchanged: Schema.Number,
    updated: Schema.Number,
  })
);

export const ExerciseQuestionSyncResultSchema = Schema.mutable(
  Schema.Struct({
    authorLinksCreated: Schema.Number,
    choicesCreated: Schema.Number,
    created: Schema.Number,
    skipped: Schema.Number,
    skippedSetSlugs: mutableArraySchema(Schema.String),
    unchanged: Schema.Number,
    updated: Schema.Number,
  })
);

export const QuranSearchSyncResultSchema = SyncSummarySchema;

export const QuranSurahSyncResultSchema = SyncSummarySchema;

export const QuranVerseSyncResultSchema = SyncSummarySchema;

export const QuranStaleDeleteResultSchema = Schema.Struct({
  routesDeleted: Schema.Number,
  searchDeleted: Schema.Number,
  surahsDeleted: Schema.Number,
  versesDeleted: Schema.Number,
});

const ContentRouteAuthorSchema = Schema.Struct({
  name: Schema.String,
});

export const RuntimeContentRouteRowSchema = Schema.mutable(
  Schema.Struct({
    alignmentId: Schema.String,
    authors: mutableArraySchema(ContentRouteAuthorSchema),
    assetId: Schema.String,
    conceptId: Schema.String,
    content_id: Schema.String,
    date: Schema.UndefinedOr(Schema.Number),
    depth: Schema.UndefinedOr(Schema.Number),
    description: Schema.UndefinedOr(Schema.String),
    kind: ContentRouteKindSchema,
    learningObjectId: Schema.String,
    locale: SyncLocaleSchema,
    lensId: Schema.String,
    markdown: Schema.Boolean,
    official: Schema.UndefinedOr(Schema.Boolean),
    parentRoute: Schema.UndefinedOr(Schema.String),
    route: Schema.String,
    section: SyncSectionSchema,
    syncedAt: Schema.Number,
    title: Schema.String,
  })
);

export const RuntimeContentRouteSchema = Schema.NullOr(
  RuntimeContentRouteRowSchema
);

export const RuntimeContentRoutePageSchema = Schema.mutable(
  Schema.Struct({
    continueCursor: Schema.String,
    isDone: Schema.Boolean,
    page: mutableArraySchema(RuntimeContentRouteRowSchema),
  })
);

const QuranLocalizedTextSchema = Schema.mutable(
  Schema.Struct({
    en: Schema.String,
    id: Schema.String,
  })
);

const QuranTextSchema = Schema.mutable(
  Schema.Struct({
    arab: Schema.String,
    transliteration: Schema.mutable(
      Schema.Struct({
        en: Schema.String,
      })
    ),
  })
);

const QuranAudioSchema = Schema.mutable(
  Schema.Struct({
    primary: Schema.String,
    secondary: mutableArraySchema(Schema.String),
  })
);

const QuranPreBismillahSchema = Schema.mutable(
  Schema.Struct({
    audio: QuranAudioSchema,
    text: QuranTextSchema,
    translation: QuranLocalizedTextSchema,
  })
);

const quranSurahMetadataFields = {
  name: Schema.mutable(
    Schema.Struct({
      long: Schema.String,
      short: Schema.String,
      translation: QuranLocalizedTextSchema,
      transliteration: QuranLocalizedTextSchema,
    })
  ),
  number: Schema.Number,
  numberOfVerses: Schema.Number,
  preBismillah: Schema.UndefinedOr(Schema.NullOr(QuranPreBismillahSchema)),
  revelation: Schema.mutable(
    Schema.Struct({
      arab: Schema.String,
      en: Schema.String,
      id: Schema.String,
    })
  ),
  sequence: Schema.Number,
};

const QuranSurahMetadataSchema = Schema.mutable(
  Schema.Struct(quranSurahMetadataFields)
);

const QuranVerseSchema = Schema.mutable(
  Schema.Struct({
    audio: QuranAudioSchema,
    meta: Schema.mutable(
      Schema.Struct({
        hizbQuarter: Schema.Number,
        juz: Schema.Number,
        manzil: Schema.Number,
        page: Schema.Number,
        ruku: Schema.Number,
        sajda: Schema.mutable(
          Schema.Struct({
            obligatory: Schema.Boolean,
            recommended: Schema.Boolean,
          })
        ),
      })
    ),
    number: Schema.mutable(
      Schema.Struct({
        inQuran: Schema.Number,
        inSurah: Schema.Number,
      })
    ),
    tafsir: Schema.mutable(
      Schema.Struct({
        id: Schema.mutable(
          Schema.Struct({
            long: Schema.String,
            short: Schema.String,
          })
        ),
      })
    ),
    text: QuranTextSchema,
    translation: QuranLocalizedTextSchema,
  })
);

export const QuranSurahPageSchema = Schema.NullOr(
  Schema.mutable(
    Schema.Struct({
      nextSurah: Schema.NullOr(QuranSurahMetadataSchema),
      prevSurah: Schema.NullOr(QuranSurahMetadataSchema),
      surahData: Schema.mutable(
        Schema.Struct({
          ...quranSurahMetadataFields,
          verses: mutableArraySchema(QuranVerseSchema),
        })
      ),
    })
  )
);

export const QuranReferenceSchema = Schema.NullOr(
  Schema.mutable(
    Schema.Struct({
      alignmentId: Schema.String,
      assetId: Schema.String,
      conceptId: Schema.String,
      content_id: Schema.String,
      learningObjectId: Schema.String,
      lensId: Schema.String,
      locale: SyncLocaleSchema,
      markdown_url: Schema.String,
      name: Schema.String,
      revelation: Schema.String,
      route: Schema.String,
      section: Schema.Literal("quran"),
      translation: Schema.String,
      url: Schema.String,
      verses: mutableArraySchema(
        Schema.mutable(
          Schema.Struct({
            arabic: Schema.String,
            number: Schema.Number,
            tafsir: Schema.optional(Schema.String),
            translation: Schema.String,
            transliteration: Schema.String,
          })
        )
      ),
    })
  )
);

export const ContentSearchResultSchema = Schema.mutable(
  Schema.Struct({
    count: Schema.Number,
    has_more: Schema.Boolean,
    items: mutableArraySchema(
      Schema.mutable(
        Schema.Struct({
          alignmentId: Schema.String,
          assetId: Schema.String,
          conceptId: Schema.String,
          content_id: Schema.String,
          description: Schema.String,
          excerpt: Schema.String,
          learningObjectId: Schema.String,
          lensId: Schema.String,
          locale: SyncLocaleSchema,
          markdown_url: Schema.String,
          route: Schema.String,
          section: SyncSectionSchema,
          title: Schema.String,
          url: Schema.String,
        })
      )
    ),
    limit: Schema.Number,
    next_offset: Schema.optional(Schema.Number),
    offset: Schema.Number,
  })
);

export const TryoutSyncResultSchema = SyncSummarySchema;

export const ExerciseSetSyncResultSchema = SyncSummarySchema;

export const SubjectTopicSyncResultSchema = SyncSummarySchema;

export const AuthorSyncResultSchema = Schema.Struct({
  created: Schema.Number,
  existing: Schema.Number,
});

export const ContentCountsSchema = Schema.Struct({
  articleReferences: Schema.Number,
  articles: Schema.Number,
  audioContentSources: Schema.Number,
  audioGenerationQueue: Schema.Number,
  authors: Schema.Number,
  contentAnalyticsPartitions: Schema.Number,
  contentAudios: Schema.Number,
  contentAuthors: Schema.Number,
  contentRouteCounts: Schema.Number,
  contentRoutePages: Schema.Number,
  contentRoutes: Schema.Number,
  contentSearch: Schema.Number,
  contentViewAnalyticsQueue: Schema.Number,
  contentViews: Schema.Number,
  exerciseAnswers: Schema.Number,
  exerciseAttempts: Schema.Number,
  exerciseChoices: Schema.Number,
  exerciseItemParameters: Schema.Number,
  exerciseQuestions: Schema.Number,
  exerciseSets: Schema.Number,
  irtCalibrationAttempts: Schema.Number,
  irtCalibrationCacheStats: Schema.Number,
  irtCalibrationQueue: Schema.Number,
  irtCalibrationRuns: Schema.Number,
  irtScalePublicationQueue: Schema.Number,
  irtScaleQualityChecks: Schema.Number,
  irtScaleQualityRefreshQueue: Schema.Number,
  irtScaleVersionItems: Schema.Number,
  irtScaleVersions: Schema.Number,
  learningProgramCoverage: Schema.Number,
  learningProgramOutcomeConcepts: Schema.Number,
  learningProgramOutcomes: Schema.Number,
  learningProgramOutlineNodes: Schema.Number,
  learningProgramSources: Schema.Number,
  learningPrograms: Schema.Number,
  learningPopularity: Schema.Number,
  quranSurahs: Schema.Number,
  quranVerses: Schema.Number,
  subjectSections: Schema.Number,
  learningTrendingBuckets: Schema.Number,
  subjectTopics: Schema.Number,
  tryoutAccessCampaignProducts: Schema.Number,
  tryoutAccessCampaigns: Schema.Number,
  tryoutAccessGrants: Schema.Number,
  tryoutAccessLinks: Schema.Number,
  tryoutAttempts: Schema.Number,
  tryoutCatalogMeta: Schema.Number,
  tryoutLeaderboardEntries: Schema.Number,
  tryoutPartAttempts: Schema.Number,
  tryoutPartSets: Schema.Number,
  tryouts: Schema.Number,
  userTryoutEntitlements: Schema.Number,
  userTryoutStats: Schema.Number,
});

export const DataIntegritySchema = Schema.Struct({
  questionsWithoutChoices: Schema.Array(Schema.String),
  questionsWithoutAuthors: Schema.Array(Schema.String),
  articlesWithoutReferences: Schema.Array(Schema.String),
  sectionsWithoutTopics: Schema.Array(Schema.String),
  activeTryoutsWithoutScale: Schema.Array(Schema.String),
  totalQuestions: Schema.Number,
  totalArticles: Schema.Number,
  totalSections: Schema.Number,
});

const GraphIdentityIssueSchema = Schema.Struct({
  assetId: Schema.optional(Schema.String),
  content_ref: Schema.optional(Schema.String),
  content_id: Schema.optional(Schema.String),
  kind: Schema.optional(Schema.String),
  route: Schema.optional(Schema.String),
  section: Schema.optional(SyncSectionSchema),
  status: Schema.optional(Schema.String),
});

export const GraphIdentityIntegrityPageSchema = Schema.Struct({
  checkedRefs: Schema.Number,
  checkedRefInputs: Schema.Number,
  continueCursor: Schema.String,
  firstInvalidRefInput: Schema.NullOr(GraphIdentityIssueSchema),
  firstMissingGraph: Schema.NullOr(GraphIdentityIssueSchema),
  firstMismatchedContentId: Schema.NullOr(GraphIdentityIssueSchema),
  firstRouteShapedContentId: Schema.NullOr(GraphIdentityIssueSchema),
  invalidRefInputs: Schema.Number,
  isDone: Schema.Boolean,
  missingGraphRows: Schema.Number,
  mismatchedContentIds: Schema.Number,
  routeShapedContentIds: Schema.Number,
  scannedRows: Schema.Number,
});

export const GraphIdentityIntegritySchema = Schema.Struct({
  checkedRefs: Schema.Number,
  checkedRefInputs: Schema.Number,
  firstInvalidRefInput: Schema.NullOr(GraphIdentityIssueSchema),
  firstMissingGraph: Schema.NullOr(GraphIdentityIssueSchema),
  firstMismatchedContentId: Schema.NullOr(GraphIdentityIssueSchema),
  firstRouteShapedContentId: Schema.NullOr(GraphIdentityIssueSchema),
  invalidRefInputs: Schema.Number,
  missingGraphRows: Schema.Number,
  mismatchedContentIds: Schema.Number,
  routeShapedContentIds: Schema.Number,
  scannedRows: Schema.Number,
});

export const TryoutScaleIntegritySchema = Schema.mutable(
  Schema.Struct({
    continueCursor: Schema.String,
    isDone: Schema.Boolean,
    page: mutableArraySchema(
      Schema.Struct({
        cycleKey: Schema.String,
        locale: SyncLocaleSchema,
        product: Schema.Literal("snbt"),
        slug: Schema.String,
      })
    ),
  })
);

const StaleItemSchema = Schema.Struct({
  id: Schema.Union(
    ConvexIdSchema("articleContents"),
    ConvexIdSchema("subjectTopics"),
    ConvexIdSchema("subjectSections"),
    ConvexIdSchema("exerciseSets"),
    ConvexIdSchema("exerciseQuestions")
  ),
  slug: Schema.String,
  locale: SyncLocaleSchema,
});

const StaleArticleSchema = Schema.Struct({
  id: ConvexIdSchema("articleContents"),
  slug: Schema.String,
  locale: SyncLocaleSchema,
});

const StaleSubjectTopicSchema = Schema.Struct({
  id: ConvexIdSchema("subjectTopics"),
  slug: Schema.String,
  locale: SyncLocaleSchema,
});

const StaleSubjectSectionSchema = Schema.Struct({
  id: ConvexIdSchema("subjectSections"),
  slug: Schema.String,
  locale: SyncLocaleSchema,
});

const StaleExerciseSetSchema = Schema.Struct({
  id: ConvexIdSchema("exerciseSets"),
  slug: Schema.String,
  locale: SyncLocaleSchema,
});

const StaleExerciseQuestionSchema = Schema.Struct({
  id: ConvexIdSchema("exerciseQuestions"),
  slug: Schema.String,
  locale: SyncLocaleSchema,
});

const PaginationPageSchema = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
});

export const StaleContentSchema = Schema.Struct({
  staleArticles: Schema.Array(StaleArticleSchema),
  staleSubjectTopics: Schema.Array(StaleSubjectTopicSchema),
  staleSubjectSections: Schema.Array(StaleSubjectSectionSchema),
  staleExerciseSets: Schema.Array(StaleExerciseSetSchema),
  staleExerciseQuestions: Schema.Array(StaleExerciseQuestionSchema),
});

export const StaleContentPageSchema = Schema.mutable(
  Schema.extend(
    PaginationPageSchema,
    Schema.Struct({
      page: mutableArraySchema(StaleItemSchema),
    })
  )
);

export const ArticleIntegrityPageSchema = Schema.mutable(
  Schema.extend(
    PaginationPageSchema,
    Schema.Struct({
      page: mutableArraySchema(StaleArticleSchema),
    })
  )
);

export const ExerciseQuestionIntegrityPageSchema = Schema.mutable(
  Schema.extend(
    PaginationPageSchema,
    Schema.Struct({
      page: mutableArraySchema(
        Schema.Struct({
          id: ConvexIdSchema("exerciseQuestions"),
          locale: SyncLocaleSchema,
          slug: Schema.String,
        })
      ),
    })
  )
);

export const ExerciseChoiceIntegrityPageSchema = Schema.mutable(
  Schema.extend(
    PaginationPageSchema,
    Schema.Struct({
      page: mutableArraySchema(
        Schema.Struct({
          questionId: ConvexIdSchema("exerciseQuestions"),
        })
      ),
    })
  )
);

export const ContentAuthorIntegrityPageSchema = Schema.mutable(
  Schema.extend(
    PaginationPageSchema,
    Schema.Struct({
      page: mutableArraySchema(
        Schema.Struct({
          authorId: ConvexIdSchema("authors"),
          contentId: ContentIdSchema,
          contentType: ContentTypeSchema,
        })
      ),
    })
  )
);

export const ArticleReferenceIntegrityPageSchema = Schema.mutable(
  Schema.extend(
    PaginationPageSchema,
    Schema.Struct({
      page: mutableArraySchema(
        Schema.Struct({
          articleId: ConvexIdSchema("articleContents"),
        })
      ),
    })
  )
);

export const SubjectSectionIntegrityPageSchema = Schema.mutable(
  Schema.extend(
    PaginationPageSchema,
    Schema.Struct({
      page: mutableArraySchema(
        Schema.Struct({
          locale: SyncLocaleSchema,
          slug: Schema.String,
          topicId: Schema.optional(ConvexIdSchema("subjectTopics")),
        })
      ),
    })
  )
);

export const AuthorPageSchema = Schema.mutable(
  Schema.extend(
    PaginationPageSchema,
    Schema.Struct({
      page: mutableArraySchema(
        Schema.Struct({
          id: ConvexIdSchema("authors"),
          name: Schema.String,
          username: Schema.String,
        })
      ),
    })
  )
);

export const UnusedAuthorsSchema = Schema.Struct({
  unusedAuthors: Schema.Array(
    Schema.Struct({
      id: ConvexIdSchema("authors"),
      name: Schema.String,
      username: Schema.String,
    })
  ),
});

export const DeleteResultSchema = Schema.Struct({
  deleted: Schema.Number,
});

export const BatchDeleteResultSchema = Schema.Struct({
  deleted: Schema.Number,
  hasMore: Schema.Boolean,
});

export const CountTablePageSchema = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  pageSize: Schema.Number,
});
