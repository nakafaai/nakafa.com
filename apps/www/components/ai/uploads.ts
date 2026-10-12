import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";

/**
 * The upload that holds each chosen file on the server, keyed by the file
 * itself so an entry goes with its file. A browser file exists only in the
 * browser that chose it, so no entry is ever shared between requests.
 */
const held = new WeakMap<File, Id<"ninaUploads">>();

/** The upload that holds this file on the server, once the file has uploaded. */
export function uploadOf(file: File) {
  return held.get(file);
}

/** Remembers the upload that holds this file, so a second send does not upload it again. */
export function keepUpload(file: File, uploadId: Id<"ninaUploads">) {
  held.set(file, uploadId);
}

/** Forgets the uploads of files that were sent or whose uploads the server no longer accepts. */
export function dropUploads(files: readonly File[]) {
  for (const file of files) {
    held.delete(file);
  }
}

/**
 * Gives back the place the server holds for a file the learner removed. A file
 * that never uploaded holds none. A release that fails is left to the server's
 * expiry of the upload, so it never blocks the learner.
 */
export const releaseUpload = Effect.fn("nina.uploads.release")(function* (
  file: File,
  release: (args: { uploadId: Id<"ninaUploads"> }) => Promise<unknown>
) {
  const uploadId = held.get(file);
  if (uploadId === undefined) {
    return;
  }
  held.delete(file);
  yield* Effect.tryPromise(() => release({ uploadId })).pipe(Effect.ignore);
});
