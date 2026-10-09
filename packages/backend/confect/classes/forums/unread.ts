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
import { Array as Arr, Effect, HashMap, Option, pipe } from "effect";

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
  return HashMap.fromIterable(
    Arr.map(readStates, ({ forumId, readState }) => [forumId, readState])
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
    forumIds: Arr.map(forums, (forum) => forum._id),
    userId,
  });
  const lastReadSequenceOf = (forumId: Id<"schoolClassForums">) =>
    Option.getOrNull(HashMap.get(readStateByForumId, forumId))
      ?.lastReadSequence ?? 0;
  const forumsWithUnreadPotential = pipe(
    forums,
    Arr.map((forum, index) => ({
      forum,
      index,
    })),
    Arr.filter(({ forum }) => {
      if (forum.postCount === 0) {
        return false;
      }
      return lastReadSequenceOf(forum._id) < forum.nextPostSequence - 1;
    })
  );
  const unreadCounts = Arr.map(forums, () => 0);
  if (forumsWithUnreadPotential.length === 0) {
    return unreadCounts;
  }
  const totalUnreadCounts = yield* Effect.promise(() =>
    forumPostsBySequence.countBatch(
      ctx,
      Arr.map(forumsWithUnreadPotential, ({ forum }) => ({
        bounds: {
          lower: {
            key: lastReadSequenceOf(forum._id),
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
      Arr.map(forumsWithUnreadPotential, ({ forum }) => ({
        bounds: {
          lower: {
            key: lastReadSequenceOf(forum._id),
            inclusive: false,
          },
        },
        namespace: [forum._id, userId],
      }))
    )
  );
  Arr.forEach(forumsWithUnreadPotential, ({ index }, batchIndex) => {
    unreadCounts[index] = Math.max(
      totalUnreadCounts[batchIndex] - ownUnreadCounts[batchIndex],
      0
    );
  });
  return unreadCounts;
});
