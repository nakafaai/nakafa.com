import type { GenericId } from "@confect/core";
import { fileAddress } from "@repo/backend/confect/bucket/file";
import type { CommentPhoto } from "@repo/backend/confect/comments/photo";
import { Effect, Option } from "effect";

/** The read address of one file of a photo, or null once its bytes are gone. */
const addressOf = (fileId: GenericId.GenericId<"bucketFiles">) =>
  Effect.map(fileAddress(fileId), Option.getOrNull);

/**
 * The photos of a comment as a list shows them. A photo without a small copy shows its own file in the
 * list, as a GIF does.
 */
export const photoViews = Effect.fn("comments.photo.views")(function* (
  photos: readonly (typeof CommentPhoto.Type)[] | undefined
) {
  return yield* Effect.forEach(photos ?? [], (photo) =>
    Effect.gen(function* () {
      const address = yield* addressOf(photo.fileId);
      const thumbnail =
        photo.thumbnailId === undefined
          ? address
          : yield* addressOf(photo.thumbnailId);
      return {
        address,
        height: photo.height,
        thumbnail,
        width: photo.width,
      };
    })
  );
});
