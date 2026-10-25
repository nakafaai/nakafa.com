import { FunctionImpl, GroupImpl } from "@confect/server";
import type { Id } from "@repo/backend/confect/_generated/id";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import spec from "@repo/backend/confect/comments/queries.spec";
import {
  type CommentDoc,
  isCommentLikedBy,
  likeCountOf,
} from "@repo/backend/confect/comments/rows";
import type { userDataValidator } from "@repo/backend/confect/lib/validators/user";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { getUserMap } from "@repo/backend/confect/users/directory";
import { photoOf } from "@repo/backend/confect/users/picture";
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
 * A comment as the lists show it: its stored fields, its count of likes (zero before
 * the count was kept), and whether the viewer liked it.
 */
function likedRow(comment: CommentDoc, liked: boolean) {
  return {
    ...comment,
    likeCount: likeCountOf(comment),
    liked,
  };
}

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
    Effect.map(isCommentLikedBy(comment._id, viewerId), (liked) => {
      const user = Option.getOrUndefined(HashMap.get(userMap, comment.userId));
      const replyToUser = comment.replyToUserId
        ? Option.getOrUndefined(
            HashMap.get(replyToUserMap, comment.replyToUserId)
          )
        : undefined;
      return {
        ...likedRow(comment, liked),
        user: user ? publicAuthor(user) : null,
        replyToUser: replyToUser ? publicAuthor(replyToUser) : null,
      };
    })
  );
});

/** Reads one page of the top-level comments of a slug, newest first. Replies are read by thread. */
const getCommentsBySlug = FunctionImpl.make(
  databaseSchema,
  spec,
  "getCommentsBySlug",
  Effect.fn("comments.queries.getCommentsBySlug")(function* (args) {
    const database = yield* DatabaseReader;
    const comments = yield* database
      .table("comments")
      .index(
        "by_slug_and_threadId",
        (q) => q.eq("slug", cleanSlug(args.slug)).eq("threadId", undefined),
        "desc"
      )
      .paginate(args.paginationOpts)
      .pipe(Effect.orDie);
    const viewer = yield* getOptionalAppUserForRead();
    return {
      ...comments,
      page: yield* withAuthors(comments.page, viewer?.appUser._id ?? null),
    };
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

/** Reads one page of an author's comments, newest first, with whether the viewer liked each. */
const getCommentsByUserId = FunctionImpl.make(
  databaseSchema,
  spec,
  "getCommentsByUserId",
  Effect.fn("comments.queries.getCommentsByUserId")(function* (args) {
    const database = yield* DatabaseReader;
    const comments = yield* database
      .table("comments")
      .index("by_userId", (q) => q.eq("userId", args.userId), "desc")
      .paginate(args.paginationOpts)
      .pipe(Effect.orDie);
    const viewer = yield* getOptionalAppUserForRead();
    const viewerId = viewer?.appUser._id ?? null;
    return {
      ...comments,
      page: yield* Effect.forEach(comments.page, (comment) =>
        Effect.map(isCommentLikedBy(comment._id, viewerId), (liked) =>
          likedRow(comment, liked)
        )
      ),
    };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getCommentsBySlug),
  Layer.provide(getCommentReplies),
  Layer.provide(getCommentsByUserId),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
