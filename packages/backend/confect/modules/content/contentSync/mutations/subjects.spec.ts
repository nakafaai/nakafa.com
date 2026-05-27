import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { localeSchema } from "@repo/backend/confect/modules/content/content.schemas";
import { Schema } from "effect";

const contentSyncMutationsSubjectsGroup = GroupSpec.make("subjects")
  .addFunction(
    FunctionSpec.internalMutation({
      name: "bulkSyncSubjectSections",
      args: Schema.Struct({
        sections: Schema.Array(
          Schema.Struct({
            authors: Schema.Array(Schema.Struct({ name: Schema.String })),
            body: Schema.String,
            category: Schema.Literal(
              "elementary-school",
              "middle-school",
              "high-school",
              "university"
            ),
            contentHash: Schema.String,
            date: Schema.Number,
            description: Schema.optional(Schema.String),
            grade: Schema.Literal(
              "1",
              "2",
              "3",
              "4",
              "5",
              "6",
              "7",
              "8",
              "9",
              "10",
              "11",
              "12",
              "bachelor",
              "master",
              "phd"
            ),
            locale: localeSchema,
            material: Schema.Literal(
              "mathematics",
              "physics",
              "chemistry",
              "biology",
              "geography",
              "economy",
              "history",
              "informatics",
              "geospatial",
              "sociology",
              "ai-ds",
              "game-engineering",
              "computer-science",
              "technology-electro-medical",
              "political-science",
              "informatics-engineering",
              "international-relations"
            ),
            section: Schema.String,
            slug: Schema.String,
            subject: Schema.optional(Schema.String),
            title: Schema.String,
            topic: Schema.String,
            topicSlug: Schema.String,
          })
        ),
      }),
      returns: Schema.Struct({
        authorLinksCreated: Schema.Number,
        created: Schema.Number,
        skipped: Schema.Number,
        skippedTopicSlugs: Schema.Array(Schema.String),
        unchanged: Schema.Number,
        updated: Schema.Number,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "bulkSyncSubjectTopics",
      args: Schema.Struct({
        topics: Schema.Array(
          Schema.Struct({
            category: Schema.Literal(
              "elementary-school",
              "middle-school",
              "high-school",
              "university"
            ),
            description: Schema.optional(Schema.String),
            grade: Schema.Literal(
              "1",
              "2",
              "3",
              "4",
              "5",
              "6",
              "7",
              "8",
              "9",
              "10",
              "11",
              "12",
              "bachelor",
              "master",
              "phd"
            ),
            locale: localeSchema,
            material: Schema.Literal(
              "mathematics",
              "physics",
              "chemistry",
              "biology",
              "geography",
              "economy",
              "history",
              "informatics",
              "geospatial",
              "sociology",
              "ai-ds",
              "game-engineering",
              "computer-science",
              "technology-electro-medical",
              "political-science",
              "informatics-engineering",
              "international-relations"
            ),
            sectionCount: Schema.Number,
            slug: Schema.String,
            title: Schema.String,
            topic: Schema.String,
          })
        ),
      }),
      returns: Schema.Struct({
        created: Schema.Number,
        unchanged: Schema.Number,
        updated: Schema.Number,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteStaleSubjectSections",
      args: Schema.Struct({
        sectionIds: Schema.Array(GenericId.GenericId("subjectSections")),
      }),
      returns: Schema.Struct({ deleted: Schema.Number }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteStaleSubjectTopics",
      args: Schema.Struct({
        topicIds: Schema.Array(GenericId.GenericId("subjectTopics")),
      }),
      returns: Schema.Struct({ deleted: Schema.Number }),
    })
  );

export { contentSyncMutationsSubjectsGroup };
