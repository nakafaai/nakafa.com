import type { Ref } from "@confect/core";
import type { InvokeReturn } from "@confect/react";
import { NinaUploadError } from "@repo/backend/client/nina/uploads";
import type nina from "@repo/backend/confect/_generated/refs/nina";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Effect } from "effect";

/** The call that gives back one upload, as the page makes it. */
type ReleaseCall = (
  args: Ref.Args<typeof nina.uploads.release>
) => InvokeReturn<typeof nina.uploads.release>;

/**
 * Gives back the places the server holds for uploads the learner will not
 * send, and returns the uploads that are no longer held: each one the server
 * gave back, and each one it refuses as gone or not the learner's, since
 * nothing is held for that one. A release that fails for any other reason is
 * logged as a warning, its upload is not returned, and the server's expiry
 * frees its place. One failure never blocks the learner or stops the others.
 *
 * The caller forgets a hold only once the server gave its place back, so the
 * hold of a failed release stays in the store and a later send gives it back.
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
  const given = yield* Effect.forEach(
    uploadIds,
    (uploadId) =>
      Effect.tryPromise(() => release({ uploadId })).pipe(
        Effect.flatMap(Effect.fromResult),
        Effect.catchTag("NinaUploadError", (refusal) =>
          refusal.code === "NINA_UPLOAD_INVALID"
            ? Effect.void
            : Effect.fail(refusal)
        ),
        Effect.as(uploadId),
        Effect.tapError((failure) =>
          Effect.logWarning(
            "An upload was not given back, so its place returns when it expires.",
            failure
          )
        ),
        Effect.option,
        Effect.annotateLogs({ uploadId })
      ),
    { concurrency: "unbounded" }
  );
  return Arr.getSomes(given);
});

/**
 * Gives back the places of refused uploads, so the send that calls it counts the
 * room it needs without them. The server counts a refused upload until a release
 * gives its place back, and no send takes it again, so each upload given back is
 * forgotten. When one could not be given back, the send fails, and that upload
 * stays refused for the next send.
 */
export const giveBackRefusedUploads = Effect.fn("nina.uploads.refused")(
  function* (
    uploadIds: readonly Id<"ninaUploads">[],
    release: ReleaseCall,
    forget: (uploadIds: readonly Id<"ninaUploads">[]) => void
  ) {
    const given = yield* releaseUploads(uploadIds, release);
    forget(given);
    if (given.length < uploadIds.length) {
      return yield* new NinaUploadError({
        code: "NINA_UPLOAD_FAILED",
        message: "An earlier attachment could not be released. Try again.",
      });
    }
  }
);
