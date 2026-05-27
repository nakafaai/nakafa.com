import { GenericId } from "@confect/core";
import { Table } from "@confect/server";
import { Schema } from "effect";

/** User bookmark collections for saved content. */
export const BookmarkCollections = Table.make(
  "bookmarkCollections",
  Schema.Struct({
    name: Schema.String,
    description: Schema.optional(Schema.String),
    userId: GenericId.GenericId("users"),
    bookmarkCount: Schema.Number,
    isDefault: Schema.Boolean,
    isPublic: Schema.Boolean,
    emoji: Schema.optional(Schema.String),
    image: Schema.String,
    order: Schema.Number,
    updatedAt: Schema.Number,
  })
);

/** Individual saved content bookmarks. */
export const Bookmarks = Table.make(
  "bookmarks",
  Schema.Struct({
    slug: Schema.String,
    userId: GenericId.GenericId("users"),
    collectionId: Schema.optional(GenericId.GenericId("bookmarkCollections")),
    note: Schema.optional(Schema.String),
    order: Schema.Number,
    bookmarkedAt: Schema.Number,
    updatedAt: Schema.optional(Schema.Number),
  })
);

/** Tables owned by the content bookmark module. */
export const tables = [Bookmarks, BookmarkCollections] as const;
