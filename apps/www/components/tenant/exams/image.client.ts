"use client";

import { Id } from "@repo/backend/confect/_generated/id";
import { FetchClient } from "@repo/utilities/http/client";
import { Effect, type Result, Schema } from "effect";
import {
  HttpBody,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/http";

/** The answer of an upload address: the storage ID that Convex gave the file. */
const StoredFile = Schema.Struct({ storageId: Id("_storage") });

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

/** Sends one file to the upload address that `exams.assets.uploadUrl` answered, and returns the storage ID the file received. */
const sendImageFile = Effect.fn("exams.image.send")(
  function* (url: URL, file: File) {
    const client = (yield* HttpClient.HttpClient).pipe(HttpClient.withScope);
    const request = HttpClientRequest.post(url, {
      body: HttpBody.raw(file, {
        contentLength: file.size,
        contentType: file.type,
      }),
    });
    const response = yield* client
      .execute(request)
      .pipe(Effect.flatMap(HttpClientResponse.filterStatusOk));
    const stored =
      yield* HttpClientResponse.schemaBodyJson(StoredFile)(response);
    return stored.storageId;
  },
  Effect.scoped,
  Effect.provide(FetchClient)
);

/**
 * Stores one image of an exam. The browser reads the file's size first, so a file that does not
 * decode never reaches the server. Then it asks for an upload address, sends the file to it, and
 * registers the stored file, which the server checks before it keeps the image. The effect
 * answers the image's ID with its size. A refusal of the server fails with its typed error, and
 * the document keeps what it held.
 */
export function storeExamImage<
  UrlError,
  RegisterError,
  Registered extends { readonly id: typeof AssetId.Type },
>({
  file,
  register,
  requestUrl,
}: {
  file: File;
  register: (args: {
    readonly height: number;
    readonly storageId: typeof StoredFile.Type.storageId;
    readonly width: number;
  }) => Promise<Result.Result<Registered, RegisterError>>;
  requestUrl: () => Promise<Result.Result<URL, UrlError>>;
}) {
  return Effect.gen(function* () {
    const size = yield* sizeOf(file);
    const url = yield* awaited(requestUrl);
    const storageId = yield* sendImageFile(url, file);
    const registered = yield* awaited(() => register({ ...size, storageId }));
    return { id: registered.id, ...size };
  });
}
