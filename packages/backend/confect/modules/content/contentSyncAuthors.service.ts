import type { Id } from "@repo/backend/confect/_generated/dataModel";
import {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/confect/_generated/services";
import {
  assertContentSyncBatchSize,
  CONTENT_SYNC_BATCH_LIMITS,
  slugify,
} from "@repo/backend/confect/modules/content/contentSync.shared";
import type { PaginationOptions } from "convex/server";
import { Effect } from "effect";

/** Upserts author rows by unique display name. */
export const bulkSyncAuthors = Effect.fn("contentSync.authors.bulkSyncAuthors")(
  function* (args: { authorNames: string[] }) {
    const ctx = yield* MutationCtx;
    yield* assertContentSyncBatchSize({
      functionName: "bulkSyncAuthors",
      limit: CONTENT_SYNC_BATCH_LIMITS.authors,
      received: args.authorNames.length,
      unit: "authors",
    });

    const uniqueNames = [...new Set(args.authorNames)];
    const authorLookups = yield* Effect.forEach(uniqueNames, (name) =>
      Effect.gen(function* () {
        const author = yield* Effect.promise(() =>
          ctx.db
            .query("authors")
            .withIndex("by_name", (query) => query.eq("name", name))
            .unique()
        );

        return { author, name };
      })
    );
    const newAuthorNames = authorLookups.flatMap(({ author, name }) =>
      author ? [] : [name]
    );

    for (const name of newAuthorNames) {
      yield* Effect.promise(() =>
        ctx.db.insert("authors", {
          name,
          username: slugify(name),
        })
      );
    }

    return {
      created: newAuthorNames.length,
      existing: uniqueNames.length - newAuthorNames.length,
    };
  }
);

/** Deletes authors that are not referenced by content author links. */
export const deleteUnusedAuthors = Effect.fn(
  "contentSync.authors.deleteUnusedAuthors"
)(function* (args: { authorIds: Id<"authors">[] }) {
  const ctx = yield* MutationCtx;
  yield* assertContentSyncBatchSize({
    functionName: "deleteUnusedAuthors",
    limit: CONTENT_SYNC_BATCH_LIMITS.unusedAuthors,
    received: args.authorIds.length,
    unit: "author IDs",
  });

  if (args.authorIds.length === 0) {
    return { deleted: 0 };
  }

  let deleted = 0;

  for (const authorId of args.authorIds) {
    const author = yield* Effect.promise(() => ctx.db.get(authorId));

    if (!author) {
      continue;
    }

    const linkedContent = yield* Effect.promise(() =>
      ctx.db
        .query("contentAuthors")
        .withIndex("by_authorId", (query) => query.eq("authorId", authorId))
        .first()
    );

    if (linkedContent) {
      continue;
    }

    yield* Effect.promise(() => ctx.db.delete(authorId));
    deleted += 1;
  }

  return { deleted };
});

/** Lists author summaries for sync tooling. */
export const listAuthorsPage = Effect.fn("contentSync.authors.listAuthorsPage")(
  function* (args: { paginationOpts: PaginationOptions }) {
    const ctx = yield* QueryCtx;
    const page = yield* Effect.promise(() =>
      ctx.db.query("authors").paginate(args.paginationOpts)
    );

    return {
      ...page,
      page: page.page.map((author) => ({
        id: author._id,
        name: author.name,
        username: author.username,
      })),
    };
  }
);
