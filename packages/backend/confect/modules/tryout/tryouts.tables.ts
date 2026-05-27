import { GenericId } from "@confect/core";
import { Table } from "@confect/server";
import { localeSchema } from "@repo/backend/confect/modules/content/content.schemas";
import { attemptEndReasonSchema } from "@repo/backend/confect/modules/learning/attempts.schemas";
import { tryoutAccessCampaignKindSchema } from "@repo/backend/confect/modules/tryout/access.tables";
import { tryoutProductSchema } from "@repo/backend/confect/modules/tryout/products";
import { Schema } from "effect";

export const tryoutStatusSchema = Schema.Literal(
  "in-progress",
  "completed",
  "expired"
);

export type TryoutStatus = Schema.Schema.Type<typeof tryoutStatusSchema>;

export const tryoutScoreStatusSchema = Schema.Literal(
  "provisional",
  "official"
);

export type TryoutScoreStatus = Schema.Schema.Type<
  typeof tryoutScoreStatusSchema
>;

export const tryoutAccessKindSchema = Schema.Literal("event", "subscription");

export type TryoutAccessKind = Schema.Schema.Type<
  typeof tryoutAccessKindSchema
>;

export const tryoutPublicResultStatusSchema = Schema.Literal(
  "estimated",
  "verified-irt",
  "final-event"
);

export type TryoutPublicResultStatus = Schema.Schema.Type<
  typeof tryoutPublicResultStatusSchema
>;

export const tryoutPartKeySchema = Schema.String;

export type TryoutPartKey = Schema.Schema.Type<typeof tryoutPartKeySchema>;

export const tryoutPartSnapshotSchema = Schema.Struct({
  partIndex: Schema.Number,
  partKey: tryoutPartKeySchema,
  questionCount: Schema.Number,
  setId: GenericId.GenericId("exerciseSets"),
});

export type TryoutPartSnapshot = Schema.Schema.Type<
  typeof tryoutPartSnapshotSchema
>;

/** tryouts table definition. */
export const Tryouts = Table.make(
  "tryouts",
  Schema.Struct({
    product: tryoutProductSchema,
    locale: localeSchema,
    cycleKey: Schema.String,
    slug: Schema.String,
    label: Schema.String,
    partCount: Schema.Number,
    totalQuestionCount: Schema.Number,
    isActive: Schema.Boolean,
    catalogPosition: Schema.Number,
    detectedAt: Schema.Number,
    syncedAt: Schema.Number,
  })
)
  .index("by_isActive", ["isActive"])
  .index("by_product_and_isActive", ["product", "isActive"])
  .index("by_product_and_locale_and_slug", ["product", "locale", "slug"])
  .index("by_product_and_locale_and_cycleKey_and_slug", [
    "product",
    "locale",
    "cycleKey",
    "slug",
  ])
  .index("by_product_and_locale_and_isActive", [
    "product",
    "locale",
    "isActive",
  ])
  .index("by_product_and_locale_and_isActive_and_catalogPosition", [
    "product",
    "locale",
    "isActive",
    "catalogPosition",
  ]);

/** tryoutCatalogMeta table definition. */
export const TryoutCatalogMeta = Table.make(
  "tryoutCatalogMeta",
  Schema.Struct({
    product: tryoutProductSchema,
    locale: localeSchema,
    activeCount: Schema.Number,
    updatedAt: Schema.Number,
  })
).index("by_product_and_locale", ["product", "locale"]);

/** tryoutPartSets table definition. */
export const TryoutPartSets = Table.make(
  "tryoutPartSets",
  Schema.Struct({
    tryoutId: GenericId.GenericId("tryouts"),
    setId: GenericId.GenericId("exerciseSets"),
    partIndex: Schema.Number,
    partKey: tryoutPartKeySchema,
  })
)
  .index("by_tryoutId_and_partIndex", ["tryoutId", "partIndex"])
  .index("by_tryoutId_and_partKey", ["tryoutId", "partKey"])
  .index("by_setId", ["setId"]);

/** tryoutAttempts table definition. */
export const TryoutAttempts = Table.make(
  "tryoutAttempts",
  Schema.Struct({
    userId: GenericId.GenericId("users"),
    tryoutId: GenericId.GenericId("tryouts"),
    scaleVersionId: GenericId.GenericId("irtScaleVersions"),
    accessKind: Schema.optional(tryoutAccessKindSchema),
    accessCampaignId: Schema.optional(
      GenericId.GenericId("tryoutAccessCampaigns")
    ),
    accessCampaignKind: Schema.optional(tryoutAccessCampaignKindSchema),
    accessGrantId: Schema.optional(GenericId.GenericId("tryoutAccessGrants")),
    accessEndsAt: Schema.optional(Schema.Number),
    countsForCompetition: Schema.optional(Schema.Boolean),
    scoreStatus: tryoutScoreStatusSchema,
    status: tryoutStatusSchema,
    partSetSnapshots: Schema.Array(tryoutPartSnapshotSchema),
    completedPartIndices: Schema.Array(Schema.Number),
    attemptNumber: Schema.Number,
    totalCorrect: Schema.Number,
    totalQuestions: Schema.Number,
    theta: Schema.Number,
    thetaSE: Schema.Number,
    startedAt: Schema.Number,
    expiresAt: Schema.Number,
    lastActivityAt: Schema.Number,
    completedAt: Schema.Union(Schema.Number, Schema.Null),
    endReason: Schema.Union(attemptEndReasonSchema, Schema.Null),
  })
)
  .index("by_status_and_expiresAt", ["status", "expiresAt"])
  .index("by_userId_and_startedAt", ["userId", "startedAt"])
  .index("by_userId_and_status_and_expiresAt", [
    "userId",
    "status",
    "expiresAt",
  ])
  .index("by_userId_and_tryoutId_and_startedAt", [
    "userId",
    "tryoutId",
    "startedAt",
  ])
  .index("by_userId_and_tryoutId_and_accessCampaignId_and_startedAt", [
    "userId",
    "tryoutId",
    "accessCampaignId",
    "startedAt",
  ])
  .index("by_accessCampaignId_and_startedAt", ["accessCampaignId", "startedAt"])
  .index("by_tryoutId_and_scoreStatus_and_status_and_startedAt", [
    "tryoutId",
    "scoreStatus",
    "status",
    "startedAt",
  ]);

/** tryoutPartAttempts table definition. */
export const TryoutPartAttempts = Table.make(
  "tryoutPartAttempts",
  Schema.Struct({
    tryoutAttemptId: GenericId.GenericId("tryoutAttempts"),
    partIndex: Schema.Number,
    partKey: tryoutPartKeySchema,
    setAttemptId: GenericId.GenericId("exerciseAttempts"),
    setId: GenericId.GenericId("exerciseSets"),
    theta: Schema.Number,
    thetaSE: Schema.Number,
  })
)
  .index("by_tryoutAttemptId_and_partIndex", ["tryoutAttemptId", "partIndex"])
  .index("by_setAttemptId", ["setAttemptId"]);

/** userTryoutStats table definition. */
export const UserTryoutStats = Table.make(
  "userTryoutStats",
  Schema.Struct({
    userId: GenericId.GenericId("users"),
    product: tryoutProductSchema,
    leaderboardNamespace: Schema.String,
    totalTryoutsCompleted: Schema.Number,
    averageTheta: Schema.Number,
    bestTheta: Schema.Number,
    averageRawScore: Schema.Number,
    lastTryoutAt: Schema.Number,
    updatedAt: Schema.Number,
  })
).index("by_userId_and_product_and_leaderboardNamespace", [
  "userId",
  "product",
  "leaderboardNamespace",
]);

/** tryoutLeaderboardEntries table definition. */
export const TryoutLeaderboardEntries = Table.make(
  "tryoutLeaderboardEntries",
  Schema.Struct({
    tryoutId: GenericId.GenericId("tryouts"),
    userId: GenericId.GenericId("users"),
    leaderboardNamespace: Schema.String,
    theta: Schema.Number,
    thetaSE: Schema.Number,
    rawScore: Schema.Number,
    completedAt: Schema.Number,
    attemptId: GenericId.GenericId("tryoutAttempts"),
  })
)
  .index("by_tryoutId_and_userId", ["tryoutId", "userId"])
  .index("by_userId_and_leaderboardNamespace_and_completedAt", [
    "userId",
    "leaderboardNamespace",
    "completedAt",
  ])
  .index("by_userId_and_leaderboardNamespace_and_theta", [
    "userId",
    "leaderboardNamespace",
    "theta",
  ]);

export const tables = [
  Tryouts,
  TryoutCatalogMeta,
  TryoutPartSets,
  TryoutAttempts,
  TryoutPartAttempts,
  UserTryoutStats,
  TryoutLeaderboardEntries,
] as const;
