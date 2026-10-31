import { Id } from "@repo/backend/confect/_generated/id";
import { LIBRARY_BYTE_LIMIT } from "@repo/backend/confect/classroom/library/file";
import { ImageType } from "@repo/editor/upload";
import { Data, Effect, Number as Num, type Result, Schema } from "effect";
import { forumCall } from "@/components/tenant/classes/forum/call";

/** The longest edge of a photo a chat keeps: as sharp as WhatsApp's standard photo, a tenth of a phone's bytes. */
const PHOTO_EDGE = 1600;

/** The longest edge of the small copy a chat's stream shows. */
const SMALL_EDGE = 480;

/** How much of a photo's detail the encoder keeps: a level no reader tells from the original at this size. */
const PHOTO_QUALITY = 0.8;

/** The type a chat keeps a photo in, and the type for a browser that does not encode it. */
const PHOTO_TYPE = "image/webp";
const FALLBACK_TYPE = "image/jpeg";

/** The ID of an uploaded file in Convex storage. */
const storageId = Id("_storage");

/** A file past what a message carries, which the browser refuses before it sends a byte. */
export class FileTooLarge extends Data.TaggedError("FileTooLarge") {}

/** The size that fits `width` by `height` inside a square of `edge`, never larger than it is. */
export const fitted = (width: number, height: number, edge: number) => {
  const scale = Num.min(1, edge / Num.max(width, height));
  return {
    height: Num.max(1, Math.round(height * scale)),
    width: Num.max(1, Math.round(width * scale)),
  };
};

/** Whether a chat shows a file as a photo. A GIF stays as it is, so it keeps moving. */
export const isPhoto = (file: Pick<File, "type">) =>
  Schema.is(ImageType)(file.type) && file.type !== "image/gif";

/** Draws a picture at one size and encodes it, in JPEG when the browser does not encode WebP. */
const encode = Effect.fn("classroom.forum.upload.encode")(function* (
  picture: ImageBitmap,
  size: { readonly height: number; readonly width: number }
) {
  const canvas = new OffscreenCanvas(size.width, size.height);
  canvas.getContext("2d")?.drawImage(picture, 0, 0, size.width, size.height);
  const encoded = yield* Effect.tryPromise(() =>
    canvas.convertToBlob({ quality: PHOTO_QUALITY, type: PHOTO_TYPE })
  );
  return encoded.type === PHOTO_TYPE
    ? encoded
    : yield* Effect.tryPromise(() =>
        canvas.convertToBlob({ quality: PHOTO_QUALITY, type: FALLBACK_TYPE })
      );
});

/**
 * The photo a chat sends: at most 1,600 pixels on its longest edge, with a small copy of 480 for the
 * stream, so a phone's 4 MB photo costs every reader about 40 KB in the stream and 300 KB when opened.
 * A photo already smaller than its encoded form stays as it is. The browser turns it the way its
 * camera held it.
 */
export const shrinkPhoto = Effect.fn("classroom.forum.upload.shrink")(
  function* (file: File) {
    const picture = yield* Effect.tryPromise(() => createImageBitmap(file));
    const size = fitted(picture.width, picture.height, PHOTO_EDGE);
    const full = yield* encode(picture, size);
    const small = yield* encode(
      picture,
      fitted(picture.width, picture.height, SMALL_EDGE)
    );
    picture.close();
    return {
      full: full.size < file.size ? full : file,
      height: size.height,
      small,
      width: size.width,
    };
  }
);

/**
 * Adds one file for the next message: a photo goes out shrunk, with its small copy, and anything
 * else as it is, then the server checks and registers it. The module that sends a file, and Effect's
 * HTTP client with it, loads only now, so the page's first JavaScript does not carry it.
 */
export const uploadAttachment = Effect.fn("classroom.forum.upload")(function* <
  UrlError,
  RegisterError,
  Registered,
>(
  file: File,
  requestUrl: () => Promise<Result.Result<URL, UrlError>>,
  register: (sent: {
    readonly height: number | null;
    readonly storageId: typeof storageId.Type;
    readonly thumbnailId: typeof storageId.Type | null;
    readonly width: number | null;
  }) => Promise<Result.Result<Registered, RegisterError>>
) {
  if (file.size > LIBRARY_BYTE_LIMIT) {
    return yield* new FileTooLarge();
  }
  const { sendStorageFile } = yield* Effect.tryPromise(
    () => import("@/components/tenant/exams/image")
  );
  const send = (bytes: Blob) =>
    Effect.flatMap(forumCall(requestUrl), (url) => sendStorageFile(url, bytes));
  if (!isPhoto(file)) {
    const sent = yield* send(file);
    const registered = yield* forumCall(() =>
      register({
        height: null,
        storageId: sent,
        thumbnailId: null,
        width: null,
      })
    );
    return { height: null, registered, width: null };
  }
  const photo = yield* shrinkPhoto(file);
  const [sent, thumbnail] = yield* Effect.all(
    [send(photo.full), send(photo.small)],
    { concurrency: 2 }
  );
  const registered = yield* forumCall(() =>
    register({
      height: photo.height,
      storageId: sent,
      thumbnailId: thumbnail,
      width: photo.width,
    })
  );
  return { height: photo.height, registered, width: photo.width };
});
