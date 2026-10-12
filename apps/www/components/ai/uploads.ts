import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";

/**
 * Gives back the places the server holds for uploads the learner will not
 * send. A release that fails is left to the server's expiry of the upload, so
 * it never blocks the learner, and one failure does not stop the others. A
 * composer that is left with files in it gives nothing back: a hidden sheet
 * keeps its files and sends the same uploads again, so the expiry covers it.
 */
export const releaseUploads = Effect.fn("nina.uploads.release")(function* (
  uploadIds: readonly Id<"ninaUploads">[],
  release: (args: { uploadId: Id<"ninaUploads"> }) => Promise<unknown>
) {
  yield* Effect.forEach(
    uploadIds,
    (uploadId) =>
      Effect.tryPromise(() => release({ uploadId })).pipe(Effect.ignore),
    { concurrency: "unbounded", discard: true }
  );
});
