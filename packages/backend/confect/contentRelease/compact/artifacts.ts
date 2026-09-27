import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { isArtifactReferenced } from "@repo/backend/confect/contentRelease/retention";
import {
  ARTIFACT_PAGE_BYTES,
  ARTIFACT_PAGE_COUNT,
} from "@repo/backend/confect/contentRelease/spec";
import { Effect } from "effect";

/** Deletes one bounded expired artifact page after reference proof. */
export const compactArtifacts = Effect.fn("contentRelease.compactArtifacts")(
  function* (cursor: null | string, cutoff: number) {
    const database = yield* DatabaseReader;
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
      deleted += yield* compactArtifact(artifact);
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
  artifact: Docs["contentArtifacts"]
) {
  const writer = yield* DatabaseWriter;
  if (yield* isArtifactReferenced(artifact.artifactHash)) {
    return 0;
  }
  yield* writer.table("contentArtifacts").delete(artifact._id);
  return 1;
});
