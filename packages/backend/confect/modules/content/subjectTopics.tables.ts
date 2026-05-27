import { Table } from "@confect/server";
import {
  gradeSchema,
  localeSchema,
  materialSchema,
  subjectCategorySchema,
} from "@repo/backend/confect/modules/content/content.schemas";
import { Schema } from "effect";

/** subjectTopics table definition. */
export const SubjectTopics = Table.make(
  "subjectTopics",
  Schema.Struct({
    locale: localeSchema,
    slug: Schema.String,
    category: subjectCategorySchema,
    grade: gradeSchema,
    material: materialSchema,
    topic: Schema.String,
    title: Schema.String,
    description: Schema.optional(Schema.String),
    sectionCount: Schema.Number,
    syncedAt: Schema.Number,
  })
).index("by_locale_and_slug", ["locale", "slug"]);

export const tables = [SubjectTopics] as const;
