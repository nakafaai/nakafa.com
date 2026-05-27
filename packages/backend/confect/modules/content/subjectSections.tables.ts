import { GenericId } from "@confect/core";
import { Table } from "@confect/server";
import {
  gradeSchema,
  localeSchema,
  materialSchema,
  subjectCategorySchema,
} from "@repo/backend/confect/modules/content/content.schemas";
import { Schema } from "effect";

/** subjectSections table definition. */
export const SubjectSections = Table.make(
  "subjectSections",
  Schema.Struct({
    topicId: GenericId.GenericId("subjectTopics"),
    locale: localeSchema,
    slug: Schema.String,
    category: subjectCategorySchema,
    grade: gradeSchema,
    material: materialSchema,
    topic: Schema.String,
    section: Schema.String,
    title: Schema.String,
    description: Schema.optional(Schema.String),
    date: Schema.Number,
    subject: Schema.optional(Schema.String),
    body: Schema.String,
    contentHash: Schema.String,
    syncedAt: Schema.Number,
  })
)
  .index("by_locale_and_slug", ["locale", "slug"])
  .index("by_topicId", ["topicId"]);

export const tables = [SubjectSections] as const;
