import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { deleteStoredArtifact } from "@repo/backend/confect/contentRelease/artifact/facts";
import { isArtifactReferenced } from "@repo/backend/confect/contentRelease/retention";
import {
  ARTIFACT_PAGE_BYTES,
  ARTIFACT_PAGE_COUNT,
} from "@repo/backend/confect/contentRelease/spec";
import { Effect } from "effect";

/**
 * Deletes one bounded expired artifact page after reference proof.
 *
 * The page reads only small artifact facts, so still-referenced artifacts past
 * their retention never load their bodies.
 */
export const compactArtifacts = Effect.fn("contentRelease.compactArtifacts")(
  function* (cursor: null | string, cutoff: number) {
    const database = yield* DatabaseReader;
    const page = yield* database
      .table("contentArtifactFacts")
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
    for (const facts of page.page) {
      deleted += yield* compactArtifact(facts);
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
  facts: Docs["contentArtifactFacts"]
) {
  if (yield* isArtifactReferenced(facts.artifactHash)) {
    return 0;
  }
  yield* deleteStoredArtifact(facts);
  return 1;
});
