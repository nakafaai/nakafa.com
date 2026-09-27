import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  QueryCtx as QueryCtxService,
} from "@repo/backend/confect/_generated/services";
import {
  forumPostsByAuthorSequence,
  forumPostsBySequence,
} from "@repo/backend/confect/classes/forums/aggregate";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";

/** Load the current viewer's read-state rows for one forum page. */
const getForumReadStateMap = Effect.fn(
  "classes.forums.unread.getForumReadStateMap"
)(function* ({
  forumIds,
  userId,
}: {
  forumIds: Id<"schoolClassForums">[];
  userId: Id<"users">;
}) {
  const readStates = yield* Effect.forEach(forumIds, (forumId) =>
    Effect.gen(function* () {
      return {
        forumId,
        readState: yield* (yield* DatabaseReader)
          .table("schoolClassForumReadStates")
          .get("by_forumId_and_userId", forumId, userId)
          .pipe(
            Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
            Effect.orDie
          ),
      };
    })
  );
  return new Map(
    readStates.map(({ forumId, readState }) => [forumId, readState])
  );
});
/**
 * Return exact unread counts for one forum page by combining total post counts
 * with the viewer's own authored posts after the stored read boundary.
 */
export const getForumUnreadCounts = Effect.fn(
  "classes.forums.unread.getForumUnreadCounts"
)(function* ({
  forums,
  userId,
}: {
  forums: Pick<
    Docs["schoolClassForums"],
    "_id" | "nextPostSequence" | "postCount"
  >[];
  userId: Id<"users">;
}) {
  const ctx = yield* QueryCtxService;
  const readStateByForumId = yield* getForumReadStateMap({
    forumIds: forums.map((forum) => forum._id),
    userId,
  });
  const forumsWithUnreadPotential = forums
    .map((forum, index) => ({
      forum,
      index,
    }))
    .filter(({ forum }) => {
      if (forum.postCount === 0) {
        return false;
      }
      const lastReadSequence =
        readStateByForumId.get(forum._id)?.lastReadSequence ?? 0;
      return lastReadSequence < forum.nextPostSequence - 1;
    });
  const unreadCounts = forums.map(() => 0);
  if (forumsWithUnreadPotential.length === 0) {
    return unreadCounts;
  }
  const totalUnreadCounts = yield* Effect.promise(() =>
    forumPostsBySequence.countBatch(
      ctx,
      forumsWithUnreadPotential.map(({ forum }) => ({
        bounds: {
          lower: {
            key: readStateByForumId.get(forum._id)?.lastReadSequence ?? 0,
            inclusive: false,
          },
        },
        namespace: forum._id,
      }))
    )
  );
  const ownUnreadCounts = yield* Effect.promise(() =>
    forumPostsByAuthorSequence.countBatch(
      ctx,
      forumsWithUnreadPotential.map(({ forum }) => ({
        bounds: {
          lower: {
            key: readStateByForumId.get(forum._id)?.lastReadSequence ?? 0,
            inclusive: false,
          },
        },
        namespace: [forum._id, userId],
      }))
    )
  );
  for (const [batchIndex, { index }] of forumsWithUnreadPotential.entries()) {
    unreadCounts[index] = Math.max(
      totalUnreadCounts[batchIndex] - ownUnreadCounts[batchIndex],
      0
    );
  }
  return unreadCounts;
});
