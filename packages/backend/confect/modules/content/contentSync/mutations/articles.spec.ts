import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import {
  articleCategorySchema,
  localeSchema,
} from "@repo/backend/confect/modules/content/content.schemas";
import { Schema } from "effect";

const contentSyncMutationsArticlesGroup = GroupSpec.make("articles")
  .addFunction(
    FunctionSpec.internalMutation({
      name: "bulkSyncArticles",
      args: Schema.Struct({
        articles: Schema.Array(
          Schema.Struct({
            articleSlug: Schema.String,
            authors: Schema.Array(Schema.Struct({ name: Schema.String })),
            body: Schema.String,
            category: articleCategorySchema,
            contentHash: Schema.String,
            date: Schema.Number,
            description: Schema.optional(Schema.String),
            locale: localeSchema,
            references: Schema.Array(
              Schema.Struct({
                authors: Schema.String,
                citation: Schema.optional(Schema.String),
                details: Schema.optional(Schema.String),
                publication: Schema.optional(Schema.String),
                title: Schema.String,
                url: Schema.optional(Schema.String),
                year: Schema.Number,
              })
            ),
            slug: Schema.String,
            title: Schema.String,
          })
        ),
      }),
      returns: Schema.Struct({
        authorLinksCreated: Schema.Number,
        created: Schema.Number,
        referencesCreated: Schema.Number,
        unchanged: Schema.Number,
        updated: Schema.Number,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteStaleArticles",
      args: Schema.Struct({
        articleIds: Schema.Array(GenericId.GenericId("articleContents")),
      }),
      returns: Schema.Struct({ deleted: Schema.Number }),
    })
  );

export { contentSyncMutationsArticlesGroup };
