import { GenericId } from "@confect/core";
import { Table } from "@confect/server";
import { contentTypeSchema } from "@repo/backend/confect/modules/content/content.schemas";
import { Schema } from "effect";

/** Polymorphic content IDs supported by the author-link join table. */
export const contentAuthorContentIdSchema = Schema.Union(
  GenericId.GenericId("articleContents"),
  GenericId.GenericId("subjectSections"),
  GenericId.GenericId("exerciseQuestions")
);

export type ContentAuthorContentId = Schema.Schema.Type<
  typeof contentAuthorContentIdSchema
>;

/** authors table definition. */
export const Authors = Table.make(
  "authors",
  Schema.Struct({
    username: Schema.String,
    name: Schema.String,
    url: Schema.optional(Schema.String),
    twitter: Schema.optional(Schema.String),
    linkedin: Schema.optional(Schema.String),
    github: Schema.optional(Schema.String),
    bio: Schema.optional(Schema.String),
    avatarUrl: Schema.optional(Schema.String),
  })
).index("by_name", ["name"]);

/** contentAuthors table definition. */
export const ContentAuthors = Table.make(
  "contentAuthors",
  Schema.Struct({
    contentId: contentAuthorContentIdSchema,
    contentType: contentTypeSchema,
    authorId: GenericId.GenericId("authors"),
    order: Schema.Number,
  })
)
  .index("by_contentId_and_contentType_and_authorId", [
    "contentId",
    "contentType",
    "authorId",
  ])
  .index("by_authorId", ["authorId"]);

export const tables = [Authors, ContentAuthors] as const;
