"use client";

import {
  NINA_FILE_COUNT,
  NINA_UPLOAD_LIFETIME,
} from "@repo/backend/client/nina/uploads";
import { Array as Arr, Duration, Option, Record as Rec } from "effect";
import type { AiState } from "@/components/ai/store/types";

/** The uploads the page holds on the server, by the id of the file each one holds. */
type Held = AiState["held"];
type Hold = Held[string];

/**
 * The hold of an upload that began at `startedAt`. The server counts the life
 * of an upload from its own reserve, which comes after that moment, so the
 * page never trusts an upload for longer than the server keeps it.
 */
export function holdOf(uploadId: Hold["uploadId"], startedAt: number): Hold {
  return {
    expiresAt: startedAt + Duration.toMillis(NINA_UPLOAD_LIFETIME),
    uploadId,
  };
}

/** Whether the server still keeps an upload at `now`: it refuses one from the moment it expires. */
function isKept(hold: Hold, now: number) {
  return hold.expiresAt > now;
}

/** The upload that holds this file, while the server still keeps it at `now`. */
export function keptUpload(held: Held, fileId: string, now: number) {
  return Rec.get(held, fileId).pipe(
    Option.filter((hold) => isKept(hold, now)),
    Option.map((hold) => hold.uploadId)
  );
}

/**
 * The holds without the ones of these uploads, and the uploads that held a file
 * among them. The server refused each of these uploads: no send takes one again,
 * and its place stays counted until the server gives it back.
 */
export function refuseHolds(
  held: Held,
  uploadIds: readonly Hold["uploadId"][]
) {
  return {
    held: Rec.filter(held, (hold) => !Arr.contains(uploadIds, hold.uploadId)),
    refused: Arr.map(
      Arr.filter(Rec.values(held), (hold) =>
        Arr.contains(uploadIds, hold.uploadId)
      ),
      (hold) => hold.uploadId
    ),
  };
}

/**
 * The files outside a send whose uploads the send has to give back, or none
 * when the send fits. The server counts every upload it has not dropped,
 * whichever composer holds its file, and refuses an upload beyond its limit. A
 * composer that is gone takes its files with it, and the places held for them
 * stay counted until the server drops them. A file of the send that holds an
 * upload needs no new place, and one whose upload the server dropped does.
 */
export function strayFiles(
  held: Held,
  fileIds: readonly string[],
  now: number
) {
  const counted = Rec.filter(held, (hold) => isKept(hold, now));
  const needing = Arr.filter(fileIds, (fileId) => !Rec.has(counted, fileId));
  if (Rec.size(counted) + needing.length <= NINA_FILE_COUNT) {
    return [];
  }
  return Arr.filter(Rec.keys(held), (fileId) => !Arr.contains(fileIds, fileId));
}
