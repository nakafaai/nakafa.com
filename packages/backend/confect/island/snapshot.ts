import type { GenericId } from "@confect/core";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  deleteFile,
  fileAddress,
  reserveUpload,
} from "@repo/backend/confect/bucket/file";
import { SnapshotRefused } from "@repo/backend/confect/island/schema";
import { Effect, Option } from "effect";

/** The type of every island snapshot. */
const SNAPSHOT_TYPE = "image/png";

/** The most bytes one snapshot takes: a 1200 by 630 PNG of flat pixel art stays far under it. */
export const SNAPSHOT_BYTE_LIMIT = 1_000_000;

/** The folder an island's snapshots are stored under, which proves an upload is this island's. */
const folderOf = (island: Docs["islands"]) => `islands/${island._id}`;

/**
 * Reserves the bytes of a new snapshot of the owner's island (ADR 0042, D20):
 * a picture over the limit is refused before any byte moves, and any other
 * charges the bucket like every account's file and answers the R2 address it
 * is uploaded to, under the island's own folder.
 */
export const reserveSnapshot = Effect.fn("island.snapshot.reserve")(function* (
  island: Docs["islands"],
  byteSize: number
) {
  if (byteSize > SNAPSHOT_BYTE_LIMIT) {
    return yield* new SnapshotRefused({ reason: "size" });
  }
  return yield* reserveUpload(
    { byteSize, contentType: SNAPSHOT_TYPE, tenantId: null },
    folderOf(island)
  );
});

/**
 * Keeps an uploaded snapshot as the island's picture and deletes the one it
 * held before. A file outside the island's folder is not its upload and is
 * refused; the snapshot it already holds changes nothing.
 */
export const keepSnapshot = Effect.fn("island.snapshot.keep")(function* (
  island: Docs["islands"],
  fileId: GenericId.GenericId<"bucketFiles">
) {
  if (island.snapshot === fileId) {
    return;
  }
  const file = yield* (yield* DatabaseReader)
    .table("bucketFiles")
    .get(fileId)
    .pipe(Effect.option);
  if (
    Option.isNone(file) ||
    !file.value.objectKey.startsWith(`${folderOf(island)}/`)
  ) {
    return yield* new SnapshotRefused({ reason: "file" });
  }
  const writer = yield* DatabaseWriter;
  yield* writer
    .table("bucketFiles")
    .patch(fileId, { state: "stored" })
    .pipe(Effect.orDie);
  yield* writer
    .table("islands")
    .patch(island._id, { snapshot: fileId })
    .pipe(Effect.orDie);
  if (island.snapshot !== undefined) {
    yield* deleteFile(island.snapshot);
  }
});

/** The signed read address of the island's snapshot, for a visit's OpenGraph image; none before the first. */
export const snapshotAddress = Effect.fn("island.snapshot.address")(function* (
  island: Docs["islands"]
) {
  if (island.snapshot === undefined) {
    return Option.none<string>();
  }
  return yield* fileAddress(island.snapshot);
});

/** Deletes the island's snapshot with its account, when it holds one. */
export const dropSnapshot = Effect.fn("island.snapshot.drop")(function* (
  island: Docs["islands"]
) {
  if (island.snapshot !== undefined) {
    yield* deleteFile(island.snapshot);
  }
});
