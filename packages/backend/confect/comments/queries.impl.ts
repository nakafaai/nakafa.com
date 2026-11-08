import { FunctionImpl, GroupImpl } from "@confect/server";
import type { Id } from "@repo/backend/confect/_generated/id";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  QueryCtx as QueryCtxService,
} from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import { readCommentPlace } from "@repo/backend/confect/comments/place";
import spec from "@repo/backend/confect/comments/queries.spec";
import {
  type CommentDoc,
  findComment,
  isCommentLikedBy,
} from "@repo/backend/confect/comments/rows";
import { photoViews } from "@repo/backend/confect/comments/signed";
import type { userDataValidator } from "@repo/backend/confect/lib/validators/user";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { getUserMap } from "@repo/backend/confect/users/directory";
import { photoOf } from "@repo/backend/confect/users/picture";
import { profileAccess } from "@repo/backend/confect/users/profile";
import { materialLayer } from "@repo/backend/content/material/confect";
import { cleanSlug } from "@repo/utilities/slug";
import { Array as Arr, Effect, HashMap, Layer, Option, Struct } from "effect";

/**
 * The public face of an author or a reply target: the animal, and the photo only
 * while the author shows it, so a hidden photo never leaves the server.
 */
function publicAuthor(user: typeof userDataValidator.Type) {
  const photo = photoOf(user);
  return {
    ...Struct.pick(user, ["_id", "mascot", "name", "picture"]),
    ...(photo === undefined ? {} : { image: photo }),
  };
}

/**
 * A comment as the lists show it: its stored fields, its photos at the addresses they are read at, and
 * whether the viewer liked it.
 */
const listedRow = Effect.fn("comments.queries.listedRow")(function* (
  comment: CommentDoc,
  viewerId: Id<"users"> | null
) {
  return {
    ...comment,
    liked: yield* isCommentLikedBy(comment._id, viewerId),
    photos: yield* photoViews(comment.photos),
  };
});

/**
 * One page of comments with the viewer's likes, and with the author and the reply
 * target of each comment. A signed-out viewer has liked nothing.
 */
const withAuthors = Effect.fn("comments.queries.withAuthors")(function* (
  page: readonly CommentDoc[],
  viewerId: Id<"users"> | null
) {
  const userMap = yield* getUserMap(Arr.map(page, (comment) => comment.userId));
  const replyToUserMap = yield* getUserMap(
    Arr.flatMap(page, (comment) =>
      comment.replyToUserId ? [comment.replyToUserId] : []
    )
  );
  return yield* Effect.forEach(page, (comment) =>
    Effect.map(listedRow(comment, viewerId), (row) => {
      const user = Option.getOrUndefined(HashMap.get(userMap, comment.userId));
      const replyToUser = comment.replyToUserId
        ? Option.getOrUndefined(
            HashMap.get(replyToUserMap, comment.replyToUserId)
          )
        : undefined;
      return {
        ...row,
        user: user ? publicAuthor(user) : null,
        replyToUser: replyToUser ? publicAuthor(replyToUser) : null,
      };
    })
  );
});

/** Reads one comment as a list shows it, or null once it is deleted. */
const getComment = FunctionImpl.make(
  databaseSchema,
  spec,
  "getComment",
  Effect.fn("comments.queries.getComment")(function* ({ commentId }) {
    const comment = yield* findComment(commentId);
    if (comment === null) {
      return null;
    }
    const viewer = yield* getOptionalAppUserForRead();
    const rows = yield* withAuthors([comment], viewer?.appUser._id ?? null);
    return Option.getOrNull(Arr.head(rows));
  })
);

/** Reads the page that shows a comment, which the inbox opens through its own address. */
const getCommentPlace = FunctionImpl.make(
  databaseSchema,
  spec,
  "getCommentPlace",
  Effect.fn("comments.queries.getCommentPlace")(function* ({
    appLocale,
    commentId,
  }) {
    const ctx = yield* QueryCtxService;
    const id = ctx.db.normalizeId("comments", commentId);
    if (id === null) {
      return null;
    }
    return yield* readCommentPlace(id, appLocale).pipe(
      Effect.provide(materialLayer),
      Effect.orDie
    );
  })
);

/**
 * Reads one page of the top-level comments of a slug: the most liked first, the newest first among
 * equals, or the newest first. Replies are read by thread.
 */
const getCommentsBySlug = FunctionImpl.make(
  databaseSchema,
  spec,
  "getCommentsBySlug",
  Effect.fn("comments.queries.getCommentsBySlug")(function* (args) {
    const table = (yield* DatabaseReader).table("comments");
    const slug = cleanSlug(args.slug);
    const ordered =
      args.sort === "top"
        ? table.index(
            "by_slug_and_threadId_and_likeCount",
            (q) => q.eq("slug", slug).eq("threadId", undefined),
            "desc"
          )
        : table.index(
            "by_slug_and_threadId",
            (q) => q.eq("slug", slug).eq("threadId", undefined),
            "desc"
          );
    const comments = yield* ordered
      .paginate(args.paginationOpts)
      .pipe(Effect.orDie);
    const viewer = yield* getOptionalAppUserForRead();
    return {
      ...comments,
      page: yield* withAuthors(comments.page, viewer?.appUser._id ?? null),
    };
  })
);

/** Reads how many comments a slug holds, replies counted. A slug without comments holds none. */
const getCommentCount = FunctionImpl.make(
  databaseSchema,
  spec,
  "getCommentCount",
  Effect.fn("comments.queries.getCommentCount")(function* (args) {
    const row = yield* (yield* DatabaseReader)
      .table("commentCounts")
      .get("by_slug", cleanSlug(args.slug))
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    return row?.count ?? 0;
  })
);

/** Reads one page of the replies of a thread, oldest first, so a reply to a reply reads after its parent. */
const getCommentReplies = FunctionImpl.make(
  databaseSchema,
  spec,
  "getCommentReplies",
  Effect.fn("comments.queries.getCommentReplies")(function* (args) {
    const database = yield* DatabaseReader;
    const replies = yield* database
      .table("comments")
      .index("by_threadId", (q) => q.eq("threadId", args.threadId), "asc")
      .paginate(args.paginationOpts)
      .pipe(Effect.orDie);
    const viewer = yield* getOptionalAppUserForRead();
    return {
      ...replies,
      page: yield* withAuthors(replies.page, viewer?.appUser._id ?? null),
    };
  })
);

/**
 * Reads one page of an author's comments, newest first, with whether the viewer liked each,
 * for whoever opens the author's profile (`profileAccess`); anyone else gets the empty page
 * of an author without comments.
 */
const getCommentsByUserId = FunctionImpl.make(
  databaseSchema,
  spec,
  "getCommentsByUserId",
  Effect.fn("comments.queries.getCommentsByUserId")(function* (args) {
    const viewer = yield* getOptionalAppUserForRead();
    const viewerId = viewer?.appUser._id ?? null;
    if (!(yield* profileAccess(args.userId, viewerId)).opens) {
      return { continueCursor: "", isDone: true, page: [] };
    }
    const database = yield* DatabaseReader;
    const comments = yield* database
      .table("comments")
      .index("by_userId", (q) => q.eq("userId", args.userId), "desc")
      .paginate(args.paginationOpts)
      .pipe(Effect.orDie);
    return {
      ...comments,
      page: yield* Effect.forEach(comments.page, (comment) =>
        listedRow(comment, viewerId)
      ),
    };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getComment),
  Layer.provide(getCommentPlace),
  Layer.provide(getCommentsBySlug),
  Layer.provide(getCommentCount),
  Layer.provide(getCommentReplies),
  Layer.provide(getCommentsByUserId),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
