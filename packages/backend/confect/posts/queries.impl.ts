import { FunctionImpl, GroupImpl } from "@confect/server";
import { POST_PAGE_SIZE } from "@repo/backend/client/posts/list";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import spec from "@repo/backend/confect/posts/queries.spec";
import { findLike } from "@repo/backend/confect/posts/rows";
import { mayReadPosts } from "@repo/backend/confect/posts/visibility";
import { Effect, Layer, Number as Num, Struct } from "effect";

const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("posts.queries.list")(function* (args) {
    const database = yield* DatabaseReader;
    const viewer = yield* getOptionalAppUserForRead();
    // A signed-out caller, or a learner who may not read these posts, gets a
    // final page with nothing on it.
    if (viewer === null || !mayReadPosts(viewer.appUser._id, args.authorId)) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    // A page holds at most POST_PAGE_SIZE posts, however many the caller asks
    // for, so the like reads below stay bounded by it. Only the cursor and the
    // size reach the read, because a range end from the caller would widen the
    // page past its size.
    const posts = yield* database
      .table("posts")
      .index("by_authorId", (q) => q.eq("authorId", args.authorId), "desc")
      .paginate({
        cursor: args.paginationOpts.cursor,
        numItems: Num.min(args.paginationOpts.numItems, POST_PAGE_SIZE),
      })
      .pipe(Effect.orDie);
    const page = yield* Effect.forEach(posts.page, (post) =>
      Effect.map(findLike(post._id, viewer.appUser._id), (like) => ({
        ...Struct.pick(post, ["_id", "_creationTime", "text", "likeCount"]),
        liked: like !== null,
      }))
    );
    return { ...posts, page };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
