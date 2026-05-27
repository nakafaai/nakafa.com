import { GenericId } from "@confect/core";
import { Table } from "@confect/server";
import {
  audioContentRefSchema,
  audioModelSchema,
  audioStatusSchema,
  voiceSettingsSchema,
} from "@repo/backend/confect/modules/content/audio.schemas";
import { localeSchema } from "@repo/backend/confect/modules/content/content.schemas";
import { Schema } from "effect";

/** contentAudios table definition. */
export const ContentAudios = Table.make(
  "contentAudios",
  Schema.Struct({
    contentRef: audioContentRefSchema,
    locale: localeSchema,
    contentHash: Schema.String,
    voiceId: Schema.String,
    voiceSettings: Schema.optional(voiceSettingsSchema),
    model: audioModelSchema,
    status: audioStatusSchema,
    script: Schema.optional(Schema.String),
    audioStorageId: Schema.optional(GenericId.GenericId("_storage")),
    audioDuration: Schema.optional(Schema.Number),
    audioSize: Schema.optional(Schema.Number),
    errorMessage: Schema.optional(Schema.String),
    failedAt: Schema.optional(Schema.Number),
    generationAttempts: Schema.Number,
    updatedAt: Schema.Number,
  })
).index("by_contentRefType_and_contentRefId_and_locale", [
  "contentRef.type",
  "contentRef.id",
  "locale",
]);

/** audioGenerationQueue table definition. */
export const AudioGenerationQueue = Table.make(
  "audioGenerationQueue",
  Schema.Struct({
    contentRef: audioContentRefSchema,
    locale: localeSchema,
    slug: Schema.String,
    priorityScore: Schema.Number,
    status: Schema.Literal("pending", "processing", "completed", "failed"),
    requestedAt: Schema.Number,
    processingStartedAt: Schema.optional(Schema.Number),
    completedAt: Schema.optional(Schema.Number),
    retryCount: Schema.Number,
    maxRetries: Schema.Number,
    errorMessage: Schema.optional(Schema.String),
    lastErrorAt: Schema.optional(Schema.Number),
    updatedAt: Schema.Number,
  })
)
  .index("by_status_and_priorityScore", ["status", "priorityScore"])
  .index("by_contentRefType_and_contentRefId_and_locale", [
    "contentRef.type",
    "contentRef.id",
    "locale",
  ])
  .index("by_slug_and_status", ["slug", "status"])
  .index("by_status_and_completedAt", ["status", "completedAt"])
  .index("by_status_and_updatedAt", ["status", "updatedAt"]);

export const tables = [ContentAudios, AudioGenerationQueue] as const;
