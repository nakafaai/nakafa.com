import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { assertContentSyncBatchSize } from "@repo/backend/convex/contentSync/lib/errors";
import { internalMutation } from "@repo/backend/convex/functions";
import { slugify } from "@repo/backend/convex/utils/helper";
import { v } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";

const bulkSyncAuthorsResultValidator = v.object({
  created: v.number(),
  existing: v.number(),
});

const deleteResultValidator = v.object({
  deleted: v.number(),
});

/** Upsert missing author rows from synced content metadata. */
export const bulkSyncAuthors = internalMutation({
  args: {
    authorNames: v.array(v.string()),
  },
  returns: bulkSyncAuthorsResultValidator,
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "bulkSyncAuthors",
      limit: CONTENT_SYNC_BATCH_LIMITS.authors,
      received: args.authorNames.length,
      unit: "authors",
    });

    const uniqueNames = [...new Set(args.authorNames)];
    const existingAuthors = await Promise.all(
      uniqueNames.map((name) =>
        ctx.db
          .query("authors")
          .withIndex("name", (q) => q.eq("name", name))
          .unique()
          .then((author) => ({ exists: author !== null, name }))
      )
    );

    const newAuthorNames = existingAuthors
      .filter((author) => !author.exists)
      .map((author) => author.name);

    for (const name of newAuthorNames) {
      await ctx.db.insert("authors", {
        name,
        username: slugify(name),
      });
    }

    return {
      created: newAuthorNames.length,
      existing: uniqueNames.length - newAuthorNames.length,
    };
  },
});

/** Delete author rows that are no longer linked from synced content. */
export const deleteUnusedAuthors = internalMutation({
  args: {
    authorIds: v.array(v.id("authors")),
  },
  returns: deleteResultValidator,
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "deleteUnusedAuthors",
      limit: CONTENT_SYNC_BATCH_LIMITS.unusedAuthors,
      received: args.authorIds.length,
      unit: "author IDs",
    });

    if (args.authorIds.length === 0) {
      return { deleted: 0 };
    }

    const authors = await getAll(ctx.db, args.authorIds);
    let deleted = 0;

    for (const [index, author] of authors.entries()) {
      if (!author) {
        continue;
      }

      const authorId = args.authorIds[index];
      const linkedContent = await ctx.db
        .query("contentAuthors")
        .withIndex("authorId", (q) => q.eq("authorId", authorId))
        .first();

      if (linkedContent) {
        continue;
      }

      await ctx.db.delete("authors", authorId);
      deleted++;
    }

    return { deleted };
  },
});
