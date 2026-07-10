import type { Id, TableNames } from "@repo/backend/convex/_generated/dataModel";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import {
  CONTENT_ROUTE_KINDS,
  NAKAFA_CONTENT_SECTIONS,
} from "@repo/backend/convex/contents/constants";
import { MaterialSchema } from "@repo/contents/_types/curriculum/material";
import { locales } from "@repo/utilities/locales";
import { Effect, Schema } from "effect";

const SyncLocaleSchema = Schema.Literal(...locales);
const SyncSectionSchema = Schema.Literal(...NAKAFA_CONTENT_SECTIONS);
const ContentRouteKindSchema = Schema.Literal(...CONTENT_ROUTE_KINDS);

/** Validates a Convex document ID while preserving its generated table brand. */
export const ConvexIdSchema = <const TableName extends TableNames>(
  tableName: TableName
) =>
  Schema.String.pipe(
    Schema.filter((value): value is Id<TableName> => value.length > 0, {
      message: () => `Expected ${tableName} document ID`,
    })
  );

/** Builds a decoded mutable array schema for generated Convex return types. */
export const mutableArraySchema = <A, I>(schema: Schema.Schema<A, I, never>) =>
  Schema.mutable(Schema.Array(schema));

export const BATCH_SIZES = {
  articles: CONTENT_SYNC_BATCH_LIMITS.articles,
  authors: CONTENT_SYNC_BATCH_LIMITS.authors,
  curriculumTopics: CONTENT_SYNC_BATCH_LIMITS.curriculumTopics,
  curriculumLessons: CONTENT_SYNC_BATCH_LIMITS.curriculumLessons,
  questionSets: CONTENT_SYNC_BATCH_LIMITS.questionSets,
  questions: CONTENT_SYNC_BATCH_LIMITS.questions,
  quranSurahs: CONTENT_SYNC_BATCH_LIMITS.quranSurahs,
  quranVerses: CONTENT_SYNC_BATCH_LIMITS.quranVerses,
  quranSearchDocuments: CONTENT_SYNC_BATCH_LIMITS.quranSearchDocuments,
  staleArticles: CONTENT_SYNC_BATCH_LIMITS.staleArticles,
  staleCurriculumTopics: CONTENT_SYNC_BATCH_LIMITS.staleCurriculumTopics,
  staleCurriculumLessons: CONTENT_SYNC_BATCH_LIMITS.staleCurriculumLessons,
  staleQuestionSets: CONTENT_SYNC_BATCH_LIMITS.staleQuestionSets,
  staleQuestions: CONTENT_SYNC_BATCH_LIMITS.staleQuestions,
  staleTryoutCountries: CONTENT_SYNC_BATCH_LIMITS.staleTryoutCountries,
  staleTryoutExams: CONTENT_SYNC_BATCH_LIMITS.staleTryoutExams,
  staleTryoutSections: CONTENT_SYNC_BATCH_LIMITS.staleTryoutSections,
  staleTryoutSets: CONTENT_SYNC_BATCH_LIMITS.staleTryoutSets,
  staleTryoutTracks: CONTENT_SYNC_BATCH_LIMITS.staleTryoutTracks,
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

export const CurriculumLessonSyncResultSchema = Schema.mutable(
  Schema.Struct({
    authorLinksCreated: Schema.Number,
    created: Schema.Number,
    skipped: Schema.Number,
    skippedTopicSlugs: mutableArraySchema(Schema.String),
    unchanged: Schema.Number,
    updated: Schema.Number,
  })
);

export const QuestionSyncResultSchema = Schema.mutable(
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
    materialDomain: Schema.UndefinedOr(MaterialSchema),
    official: Schema.UndefinedOr(Schema.Boolean),
    parentRoute: Schema.UndefinedOr(Schema.String),
    route: Schema.String,
    section: SyncSectionSchema,
    sourceParentPath: Schema.UndefinedOr(Schema.String),
    sourcePath: Schema.String,
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

export const QuestionSetSyncResultSchema = SyncSummarySchema;

export const CurriculumTopicSyncResultSchema = SyncSummarySchema;

const PublicRouteSyncStateSchema = Schema.Struct({
  hash: Schema.String,
  rowCount: Schema.Number,
  shard: Schema.Number,
});

export const PublicRouteRootStateSchema = Schema.NullOr(
  PublicRouteSyncStateSchema
);

export const PublicRouteSyncStatePageSchema = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  page: mutableArraySchema(PublicRouteSyncStateSchema),
});

export const PublicRouteSyncResultSchema = Schema.Struct({
  created: Schema.Number,
  deleted: Schema.Number,
  unchanged: Schema.Number,
  updated: Schema.Number,
});

export const AuthorSyncResultSchema = Schema.Struct({
  created: Schema.Number,
  existing: Schema.Number,
});
