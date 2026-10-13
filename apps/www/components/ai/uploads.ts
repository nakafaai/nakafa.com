import type { Ref } from "@confect/core";
import type { InvokeReturn } from "@confect/react";
import type nina from "@repo/backend/confect/_generated/refs/nina";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";

/** The call that gives back one upload, as the page makes it. */
type ReleaseCall = (
  args: Ref.Args<typeof nina.uploads.release>
) => InvokeReturn<typeof nina.uploads.release>;

/**
 * Gives back the places the server holds for uploads the learner will not
 * send. A release that fails is logged as a warning and left to the server's
 * expiry of the upload, so it never blocks the learner, and one failure does
 * not stop the others. A call fails when it is rejected, and when the server
 * refuses it and says why. One refusal is no failure: the server calls the
 * upload gone or not the learner's, so nothing is held for it.
 *
 * A composer that is left with files in it gives nothing back at once. A
 * hidden sheet keeps its files and sends the same uploads again, and the page
 * cannot tell a hidden composer from a destroyed one. The next send that needs
 * the room gives back what is held for files outside it, and the server's
 * expiry covers the rest.
 */
export const releaseUploads = Effect.fn("nina.uploads.release")(function* (
  uploadIds: readonly Id<"ninaUploads">[],
  release: ReleaseCall
) {
  yield* Effect.forEach(
    uploadIds,
    (uploadId) =>
      Effect.tryPromise(() => release({ uploadId })).pipe(
        Effect.flatMap(Effect.fromResult),
        Effect.catchTag("NinaUploadError", (refusal) =>
          refusal.code === "NINA_UPLOAD_INVALID"
            ? Effect.void
            : Effect.fail(refusal)
        ),
        Effect.ignore({
          log: "Warn",
          message:
            "An upload was not given back, so its place returns when it expires.",
        }),
        Effect.annotateLogs({ uploadId })
      ),
    { concurrency: "unbounded", discard: true }
  );
});
