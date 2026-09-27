import { DatabaseReader, DatabaseWriter } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { isArtifactReferenced } from "@repo/backend/confect/contentRelease/retention";
import {
  ARTIFACT_PAGE_BYTES,
  ARTIFACT_PAGE_COUNT,
} from "@repo/backend/confect/contentRelease/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

/** Deletes one bounded expired artifact page after reference proof. */
export const compactArtifacts = Effect.fn("contentRelease.compactArtifacts")(
  function* (ctx: MutationCtx, cursor: null | string, cutoff: number) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const page = yield* database
      .table("contentArtifacts")
      .index("by_retainUntil_and_artifactHash", (query) =>
        query.lte("retainUntil", cutoff)
      )
      .paginate({
        cursor,
        maximumBytesRead: ARTIFACT_PAGE_BYTES,
        maximumRowsRead: ARTIFACT_PAGE_COUNT,
        numItems: ARTIFACT_PAGE_COUNT,
      })
      .pipe(Effect.orDie);
    let deleted = 0;
    for (const artifact of page.page) {
      deleted += yield* compactArtifact(ctx, artifact);
    }
    return {
      cursor: page.isDone ? null : page.continueCursor,
      deleted,
      done: page.isDone,
    };
  }
);

/** Deletes one unreferenced artifact without changing its retention owner. */
const compactArtifact = Effect.fn("contentRelease.compactArtifact")(function* (
  ctx: MutationCtx,
  artifact: Doc<"contentArtifacts">
) {
  const writer = DatabaseWriter.make(databaseSchema, ctx.db);
  if (yield* isArtifactReferenced(ctx, artifact.artifactHash)) {
    return 0;
  }
  yield* writer.table("contentArtifacts").delete(artifact._id);
  return 1;
});
