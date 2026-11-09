import type { CommentUploadsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { deleteFile } from "@repo/backend/confect/bucket/file";
import { photoFiles } from "@repo/backend/confect/comments/photo";
import { Effect } from "effect";

/** Deletes one unposted photo with its files, whose bytes go back to the bucket. */
export const dropUpload = Effect.fn("comments.unposted.drop")(function* (
  upload: CommentUploadsDoc
) {
  yield* Effect.forEach(photoFiles([upload]), deleteFile);
  yield* (yield* DatabaseWriter)
    .table("commentUploads")
    .delete(upload._id)
    .pipe(Effect.orDie);
});
