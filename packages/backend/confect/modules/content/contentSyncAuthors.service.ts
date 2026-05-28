import type { Id } from "@repo/backend/confect/_generated/dataModel";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/confect/modules/content/constants";
import {
  assertContentSyncBatchSize,
  slugify,
} from "@repo/backend/confect/modules/content/contentSync.shared";
import type { PaginationOptions } from "convex/server";
import { Effect, Option } from "effect";

/** Upserts author rows by unique display name. */
export const bulkSyncAuthors = Effect.fn("contentSync.authors.bulkSyncAuthors")(
  function* (args: { authorNames: string[] }) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    yield* assertContentSyncBatchSize({
      functionName: "bulkSyncAuthors",
      limit: CONTENT_SYNC_BATCH_LIMITS.authors,
      received: args.authorNames.length,
      unit: "authors",
    });

    const uniqueNames = [...new Set(args.authorNames)];
    const authorLookups = yield* Effect.forEach(uniqueNames, (name) =>
      Effect.gen(function* () {
        const author = yield* reader
          .table("authors")
          .get("by_name", name)
          .pipe(
            Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null))
          );

        return { author, name };
      })
    );
    const newAuthorNames = authorLookups.flatMap(({ author, name }) =>
      author ? [] : [name]
    );

    for (const name of newAuthorNames) {
      yield* writer.table("authors").insert({
        name,
        username: slugify(name),
      });
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
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
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
    const author = yield* reader
      .table("authors")
      .get(authorId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

    if (!author) {
      continue;
    }

    const linkedContent = yield* reader
      .table("contentAuthors")
      .index("by_authorId", (query) => query.eq("authorId", authorId))
      .first();

    if (Option.isSome(linkedContent)) {
      continue;
    }

    yield* writer.table("authors").delete(authorId);
    deleted += 1;
  }

  return { deleted };
});

/** Lists author summaries for sync tooling. */
export const listAuthorsPage = Effect.fn("contentSync.authors.listAuthorsPage")(
  function* (args: { paginationOpts: PaginationOptions }) {
    const reader = yield* DatabaseReader;
    const page = yield* reader
      .table("authors")
      .index("by_creation_time")
      .paginate(args.paginationOpts);

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
