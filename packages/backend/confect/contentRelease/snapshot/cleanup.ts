import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { isSnapshotReferenced } from "@repo/backend/confect/contentRelease/snapshot/retention";
import {
  deleteSnapshotChild,
  loadSnapshotChildren,
} from "@repo/backend/confect/contentRelease/snapshot/rows";
import { ROLLBACK_RETENTION_MS } from "@repo/backend/confect/contentRelease/spec";
import { Effect, Option } from "effect";

/** Reads one resumable or newly expired immutable snapshot. */
export const loadExpiredSnapshot = Effect.fn(
  "contentRelease.loadExpiredSnapshot"
)(function* (cutoff: number) {
  const database = yield* DatabaseReader;
  const retry = yield* database
    .table("contentSnapshots")
    .index("by_cleanupRetryAt_and_family_and_snapshotId", (query) =>
      query.gt("cleanupRetryAt", undefined).lte("cleanupRetryAt", cutoff)
    )
    .first()
    .pipe(Effect.map(Option.getOrNull));
  if (retry) {
    return retry;
  }
  return yield* database
    .table("contentSnapshots")
    .index("by_retainUntil_and_family_and_snapshotId", (query) =>
      query.lte("retainUntil", cutoff)
    )
    .first()
    .pipe(Effect.map(Option.getOrNull));
}, Effect.orDie);

/** Persists one incomplete physical cleanup page. */
const persistCleanup = Effect.fn("contentRelease.persistSnapshotCleanup")(
  function* (
    snapshot: Docs["contentSnapshots"],
    cutoff: number,
    cleanupIndex: number | undefined,
    cleanupPart: Docs["contentSnapshots"]["cleanupPart"]
  ) {
    const writer = yield* DatabaseWriter;
    yield* writer
      .table("contentSnapshots")
      .patch(snapshot._id, {
        cleanupAt: snapshot.cleanupAt ?? cutoff,
        cleanupIndex,
        cleanupPart,
        cleanupRetryAt: cutoff,
      })
      .pipe(Effect.orDie);
  }
);

/** Advances the physical table sequence only after its current page is complete. */
function nextCleanupPart(
  family: Docs["contentSnapshots"]["family"],
  part: Docs["contentSnapshots"]["cleanupPart"]
): Docs["contentSnapshots"]["cleanupPart"] {
  if (family === "program" && part === "program") {
    return "curriculum";
  }
  if (family === "program" && part === "curriculum") {
    return "bucket";
  }
  if (family === "quran" && part === "quran") {
    return "quran-search";
  }
  if (family === "tryout" && part === "catalog") {
    return "placement";
  }
  if (family === "tryout" && part === "placement") {
    return "runtime";
  }
  return undefined;
}

/** Deletes one bounded snapshot page without exposing partial data. */
export const compactSnapshots = Effect.fn("contentRelease.compactSnapshots")(
  function* (cutoff: number) {
    const writer = yield* DatabaseWriter;
    const snapshot = yield* loadExpiredSnapshot(cutoff);
    if (!snapshot) {
      return {
        cursor: null,
        deleted: 0,
        done: true,
      };
    }
    const referenced = yield* isSnapshotReferenced(
      snapshot.family,
      snapshot.snapshotId
    );
    if (referenced) {
      if (snapshot.cleanupAt !== undefined) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Snapshot ${snapshot.family}/${snapshot.snapshotId} became referenced during cleanup.`
        );
      }
      yield* writer
        .table("contentSnapshots")
        .patch(snapshot._id, {
          retainUntil: cutoff + ROLLBACK_RETENTION_MS,
        })
        .pipe(Effect.orDie);
      return {
        cursor: null,
        deleted: 0,
        done: false,
      };
    }
    const children = yield* loadSnapshotChildren(
      snapshot.family,
      snapshot.snapshotId,
      snapshot.cleanupIndex ?? -1,
      snapshot.cleanupPart
    );
    for (const child of children.children) {
      yield* deleteSnapshotChild(child);
    }
    if (!children.done) {
      const last = children.children.at(-1);
      if (!last) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Snapshot ${snapshot.family}/${snapshot.snapshotId} lost its cleanup page.`
        );
      }
      const nextIndex = "index" in last.row ? last.row.index : undefined;
      if (children.part !== "runtime" && nextIndex === undefined) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Snapshot ${snapshot.family}/${snapshot.snapshotId} lost its cleanup position.`
        );
      }
      yield* persistCleanup(snapshot, cutoff, nextIndex, children.part);
      return {
        cursor: null,
        deleted: children.children.length,
        done: false,
      };
    }
    const nextPart = nextCleanupPart(snapshot.family, children.part);
    if (nextPart !== undefined) {
      yield* persistCleanup(snapshot, cutoff, undefined, nextPart);
      return {
        cursor: null,
        deleted: children.children.length,
        done: false,
      };
    }
    yield* writer.table("contentSnapshots").delete(snapshot._id);
    return {
      cursor: null,
      deleted: children.children.length + 1,
      done: false,
    };
  }
);
