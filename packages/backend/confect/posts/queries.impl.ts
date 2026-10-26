import { FunctionImpl, GroupImpl } from "@confect/server";
import { POST_PAGE_SIZE } from "@repo/backend/client/posts/list";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import spec from "@repo/backend/confect/posts/queries.spec";
import { isLikedBy } from "@repo/backend/confect/posts/rows";
import { profileAccess } from "@repo/backend/confect/users/profile";
import { Effect, Layer, Number as Num, Struct } from "effect";

/**
 * Reads one page of an author's posts, newest first, for whoever opens the author's
 * profile (`profileAccess`): anyone, signed in or not, unless the author belongs to a
 * school, whose posts only the author reads; anyone else gets the empty page of an
 * author without posts. Each post says whether the caller has liked it, and a
 * signed-out caller has liked nothing.
 */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("posts.queries.list")(function* (args) {
    const database = yield* DatabaseReader;
    const viewer = yield* getOptionalAppUserForRead();
    const viewerId = viewer?.appUser._id ?? null;
    if (!(yield* profileAccess(args.authorId, viewerId)).opens) {
      return { continueCursor: "", isDone: true, page: [] };
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
      Effect.map(isLikedBy(post._id, viewerId), (liked) => ({
        ...Struct.pick(post, ["_id", "_creationTime", "text", "likeCount"]),
        liked,
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
