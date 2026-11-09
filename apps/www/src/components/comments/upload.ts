import { Id } from "@repo/backend/confect/_generated/id";
import { COMMENT_PHOTO_BYTE_LIMIT } from "@repo/backend/confect/comments/photo";
import { ImageType } from "@repo/editor/upload";
import { Data, Effect, Option, type Result, Schema } from "effect";
import { isPhoto, shrinkPhoto } from "@/components/tenant/classes/forum/upload";

/** The file of the bucket that one reservation names. */
const fileIdSchema = Id("bucketFiles");

/** What a reservation answers: the presigned R2 address of the upload and the file it becomes. */
const Reserved = Schema.Struct({
  address: Schema.String,
  fileId: fileIdSchema,
});

/** A file that no comment carries: no PNG, JPEG, WebP or GIF image, or one past the limit. */
export class PhotoRefused extends Data.TaggedError("PhotoRefused")<{
  readonly reason: "size" | "type";
}> {}

/** The kind of image a file declares, when it is one a comment carries. */
const imageTypeOf = (file: Blob) =>
  Schema.decodeUnknownOption(ImageType)(file.type);

/** One call of the page's client, whose refusal becomes the failure of the upload. */
const call = <A, E>(send: () => Promise<Result.Result<A, E>>) =>
  Effect.tryPromise(send).pipe(Effect.flatMap(Effect.fromResult));

/** The size of a picture in pixels, as the browser reads it, turned the way its camera held it. */
const measure = Effect.fn("comments.upload.measure")(function* (file: File) {
  const picture = yield* Effect.tryPromise(() => createImageBitmap(file));
  const size = { height: picture.height, width: picture.width };
  picture.close();
  return size;
});

/**
 * Uploads one photo of a comment, and answers its registered upload with its size in pixels: a photo goes
 * out shrunk to 1,600 pixels with its small copy of 480 for the list, and a GIF as it is, so it keeps
 * moving. Each file goes straight to R2 at the address its reservation answers, then the server checks the
 * photo and registers it. The module that sends a file, and Effect's HTTP client with it, loads only now,
 * so the page's first JavaScript does not carry it.
 */
export const uploadPhoto = Effect.fn("comments.upload.photo")(function* <
  ReserveError,
  RegisterError,
>(
  file: File,
  reserve: (
    bytes: Blob,
    contentType: typeof ImageType.Type
  ) => Promise<Result.Result<typeof Reserved.Type, ReserveError>>,
  register: (sent: {
    readonly fileId: typeof fileIdSchema.Type;
    readonly height: number;
    readonly thumbnailId: typeof fileIdSchema.Type | null;
    readonly width: number;
  }) => Promise<Result.Result<Id<"commentUploads">, RegisterError>>
) {
  if (Option.isNone(imageTypeOf(file))) {
    return yield* new PhotoRefused({ reason: "type" });
  }
  const { putFile } = yield* Effect.tryPromise(() => import("@/lib/files/put"));
  const send = (bytes: Blob) =>
    Option.match(imageTypeOf(bytes), {
      onNone: () => Effect.fail(new PhotoRefused({ reason: "type" })),
      onSome: (contentType) =>
        Effect.flatMap(
          call(() => reserve(bytes, contentType)),
          (reserved) =>
            putFile(reserved.address, bytes).pipe(Effect.as(reserved.fileId))
        ),
    });
  if (!isPhoto(file)) {
    if (file.size > COMMENT_PHOTO_BYTE_LIMIT) {
      return yield* new PhotoRefused({ reason: "size" });
    }
    const size = yield* measure(file);
    const fileId = yield* send(file);
    const upload = yield* call(() =>
      register({ ...size, fileId, thumbnailId: null })
    );
    return { ...size, upload };
  }
  const photo = yield* shrinkPhoto(file);
  const [fileId, thumbnailId] = yield* Effect.all(
    [send(photo.full), send(photo.small)],
    { concurrency: 2 }
  );
  const size = { height: photo.height, width: photo.width };
  const upload = yield* call(() => register({ ...size, fileId, thumbnailId }));
  return { ...size, upload };
});
