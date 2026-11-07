import { FetchClient } from "@repo/utilities/http/client";
import { Effect } from "effect";
import {
  HttpBody,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/http";

/**
 * Sends one file straight to the presigned R2 address the server reserved for it, so no byte passes through a
 * Worker or Convex. The address binds the file's length and type, so the request sends both as the file declares
 * them, and R2 refusing the upload fails with its HTTP error.
 */
export const putFile = Effect.fn("files.put")(
  function* (address: string, file: Blob) {
    const client = (yield* HttpClient.HttpClient).pipe(HttpClient.withScope);
    yield* client
      .execute(
        HttpClientRequest.put(address, {
          body: HttpBody.raw(file, {
            contentLength: file.size,
            contentType: file.type,
          }),
        })
      )
      .pipe(Effect.flatMap(HttpClientResponse.filterStatusOk));
  },
  Effect.scoped,
  Effect.provide(FetchClient)
);
