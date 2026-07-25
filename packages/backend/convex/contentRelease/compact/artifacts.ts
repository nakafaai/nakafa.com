import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { isArtifactReferenced } from "@repo/backend/convex/contentRelease/retention";
import {
  ARTIFACT_PAGE_BYTES,
  ARTIFACT_PAGE_COUNT,
} from "@repo/backend/convex/contentRelease/spec";
import { Effect } from "effect";

/** Deletes one bounded expired artifact page after reference proof. */
export const compactArtifacts = Effect.fn("contentRelease.compactArtifacts")(
  function* (ctx: MutationCtx, cursor: null | string, cutoff: number) {
    const page = yield* Effect.promise(() =>
      ctx.db
        .query("contentArtifacts")
        .withIndex("by_retainUntil_and_artifactHash", (query) =>
          query.lte("retainUntil", cutoff)
        )
        .paginate({
          cursor,
          maximumBytesRead: ARTIFACT_PAGE_BYTES,
          maximumRowsRead: ARTIFACT_PAGE_COUNT,
          numItems: ARTIFACT_PAGE_COUNT,
        })
    );
    let deleted = 0;
    for (const artifact of page.page) {
      if (yield* isArtifactReferenced(ctx, artifact.artifactHash)) {
        continue;
      }
      yield* Effect.promise(() =>
        ctx.db.delete("contentArtifacts", artifact._id)
      );
      deleted += 1;
    }
    return {
      cursor: page.isDone ? null : page.continueCursor,
      deleted,
      done: page.isDone,
    };
  }
);
