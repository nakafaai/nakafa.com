import { Id } from "@repo/backend/confect/_generated/id";
import { Effect, type Result, Schema } from "effect";

/** What the server answers for a reserved file: the R2 address its bytes go to, and the file's ID. */
const Reserved = Schema.Struct({
  address: Schema.String,
  fileId: Id("bucketFiles"),
});

/** The size and type a file is reserved with, as the browser reads them from the file. */
const FileSize = Schema.Struct({
  byteSize: Schema.Int,
  contentType: Schema.String,
});

/** The size of an image in pixels, as the browser decodes the file. */
const Size = Schema.Struct({
  height: Schema.Int.check(Schema.isGreaterThan(0)),
  width: Schema.Int.check(Schema.isGreaterThan(0)),
});

/** The ID of an image of an exam, which a document holds as its asset. */
const AssetId = Id("examAssets");

/** A file that the browser cannot decode as an image, so its size is unknown. Nothing is uploaded. */
class ImageUnreadable extends Schema.TaggedError<ImageUnreadable>()(
  "ImageUnreadable",
  {}
) {}

/** Awaits one call's answer, and fails with the typed error that the answer holds. */
const awaited = <A, E>(call: () => Promise<Result.Result<A, E>>) =>
  Effect.tryPromise(call).pipe(Effect.flatMap(Effect.fromResult));

/**
 * The size of an image file, which the browser reads from the file it decodes. A file that does
 * not decode, or that decodes to no size, fails with `ImageUnreadable`.
 */
const sizeOf = Effect.fn("exams.image.size")(function* (file: File) {
  const bitmap = yield* Effect.tryPromise({
    catch: () => new ImageUnreadable(),
    try: () => createImageBitmap(file),
  });
  const size = { height: bitmap.height, width: bitmap.width };
  bitmap.close();
  return yield* Schema.decodeEffect(Size)(size).pipe(
    Effect.mapError(() => new ImageUnreadable())
  );
});

/**
 * Reserves one file of the exam, sends its bytes straight to the R2 address the reservation answered, and answers
 * the file's ID: an image of the exam, or a page image of an import. A refusal of the reservation fails with its
 * typed error, and a refused upload with its HTTP error.
 */
export function sendFile<ReserveError>(
  reserve: (
    size: typeof FileSize.Type
  ) => Promise<Result.Result<typeof Reserved.Type, ReserveError>>,
  file: Blob
) {
  return Effect.gen(function* () {
    const reserved = yield* awaited(() =>
      reserve({ byteSize: file.size, contentType: file.type })
    );
    const { putFile } = yield* Effect.promise(() => import("@/lib/files/put"));
    yield* putFile(reserved.address, file);
    return reserved.fileId;
  });
}

/**
 * Stores one image of an exam. The browser reads the file's size first, so a file that does not
 * decode never reaches the server. Then it reserves the file, sends its bytes to R2, and
 * registers the stored file, which the server checks before it keeps the image. The effect
 * answers the image's ID with its size. A refusal of the server fails with its typed error, and
 * the document keeps what it held.
 */
export function storeExamImage<
  ReserveError,
  RegisterError,
  Registered extends { readonly id: typeof AssetId.Type },
>({
  file,
  register,
  reserve,
}: {
  file: File;
  register: (args: {
    readonly fileId: typeof Reserved.Type.fileId;
    readonly height: number;
    readonly width: number;
  }) => Promise<Result.Result<Registered, RegisterError>>;
  reserve: (
    size: typeof FileSize.Type
  ) => Promise<Result.Result<typeof Reserved.Type, ReserveError>>;
}) {
  return Effect.gen(function* () {
    const size = yield* sizeOf(file);
    const fileId = yield* sendFile(reserve, file);
    const registered = yield* awaited(() => register({ ...size, fileId }));
    return { id: registered.id, ...size };
  });
}
