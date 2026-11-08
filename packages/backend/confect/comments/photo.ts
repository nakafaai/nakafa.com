import type { GenericId } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { fileAddress } from "@repo/backend/confect/bucket/file";
import { Array as Arr, Effect, Option, Schema } from "effect";

/** The most photos one comment carries. */
export const COMMENT_PHOTO_LIMIT = 4;

/**
 * The most bytes of one photo a comment carries. The browser shrinks a photo to 1,600 pixels on its
 * longest edge before it uploads it, so an honest photo stays far under this, and a GIF keeps its frames.
 */
export const COMMENT_PHOTO_BYTE_LIMIT = 5 * 1024 * 1024;

/**
 * The most bytes of a photo's small copy, which the list shows: the browser makes it 480 pixels wide, so
 * an honest one stays far under this.
 */
export const COMMENT_THUMBNAIL_BYTE_LIMIT = 256 * 1024;

/** A photo's size in pixels. */
export const Pixels = Schema.Int.check(
  Schema.isBetween({ maximum: 20_000, minimum: 1 })
);

/**
 * One photo a comment carries (ADR 0028): the file that holds it, its small copy for the list when it
 * has one, and its size in pixels, so its place in the list never moves when it loads. A GIF has no small
 * copy, so it keeps moving.
 */
export const CommentPhoto = Schema.Struct({
  fileId: Id("bucketFiles"),
  height: Pixels,
  thumbnailId: Schema.optionalKey(Id("bucketFiles")),
  width: Pixels,
});

/** The photos of a comment, at most `COMMENT_PHOTO_LIMIT`. */
export const CommentPhotos = Schema.Array(CommentPhoto).check(
  Schema.isMaxLength(COMMENT_PHOTO_LIMIT)
);

/** One photo of a comment as a list shows it, its addresses read for this read alone (ADR 0028). */
export const CommentPhotoView = Schema.Struct({
  address: Schema.NullOr(Schema.String),
  height: Pixels,
  thumbnail: Schema.NullOr(Schema.String),
  width: Pixels,
});

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

/** The files of a comment's photos, every small copy among them, which a deletion removes. */
export const photoFiles = (
  photos: readonly (typeof CommentPhoto.Type)[] | undefined
) =>
  Arr.flatMap(photos ?? [], (photo) =>
    photo.thumbnailId === undefined
      ? [photo.fileId]
      : [photo.fileId, photo.thumbnailId]
  );
