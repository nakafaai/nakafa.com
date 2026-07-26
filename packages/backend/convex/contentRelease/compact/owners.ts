import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadContentOwner } from "@repo/backend/convex/contentRelease/scope/owner";
import {
  COMPACTION_PAGE_BYTES,
  COMPACTION_PAGE_COUNT,
} from "@repo/backend/convex/contentRelease/spec";
import { Effect } from "effect";

/** Deletes one ownership version while retaining the effective floor state. */
const compactOwner = Effect.fn("contentRelease.compactOwner")(function* (
  ctx: MutationCtx,
  row: Doc<"contentOwners">,
  from: number,
  floor: number
) {
  const anchor = yield* loadContentOwner(
    ctx,
    row.contentKey,
    row.locale,
    floor
  );
  if (!anchor) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Content ${row.contentKey}/${row.locale} lost its ownership anchor.`
    );
  }
  let deleted = 0;
  if (anchor._id !== row._id) {
    yield* Effect.promise(() => ctx.db.delete("contentOwners", row._id));
    deleted += 1;
  }
  const prior = yield* loadContentOwner(
    ctx,
    row.contentKey,
    row.locale,
    row.sequence - 1
  );
  if (prior && prior.sequence < from && prior._id !== anchor._id) {
    yield* Effect.promise(() => ctx.db.delete("contentOwners", prior._id));
    deleted += 1;
  }
  return deleted;
});

/** Compacts one bounded immutable exact-ownership page. */
export const compactOwners = Effect.fn("contentRelease.compactOwners")(
  function* (
    ctx: MutationCtx,
    from: number,
    floor: number,
    cursor: null | string
  ) {
    const page = yield* Effect.promise(() =>
      ctx.db
        .query("contentOwners")
        .withIndex("by_sequence", (query) =>
          query.gte("sequence", from).lte("sequence", floor)
        )
        .paginate({
          cursor,
          maximumBytesRead: COMPACTION_PAGE_BYTES,
          maximumRowsRead: COMPACTION_PAGE_COUNT,
          numItems: COMPACTION_PAGE_COUNT,
        })
    );
    let deleted = 0;
    for (const row of page.page) {
      deleted += yield* compactOwner(ctx, row, from, floor);
    }
    return {
      cursor: page.isDone ? null : page.continueCursor,
      deleted,
      done: page.isDone,
    };
  }
);
