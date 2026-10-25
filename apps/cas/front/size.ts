import { Data, Effect } from "effect";

/** The request body is larger than the limit that the engine accepts. */
export class CasRequestTooLarge extends Data.TaggedError("CasRequestTooLarge")<{
  readonly limit: number;
}> {}

/** The request body could not be read, because the client or its stream failed. */
export class CasRequestUnreadable extends Data.TaggedError(
  "CasRequestUnreadable"
)<{
  readonly cause: unknown;
}> {}

/**
 * Reads a request body up to `limit` bytes into one buffer of that size. The
 * first chunk that crosses the limit cancels the stream, so an oversized body
 * is never read in full.
 */
export const readBoundedBody = Effect.fn("cas.size.readBoundedBody")(function* (
  body: ReadableStream<Uint8Array> | null,
  limit: number
) {
  if (body === null) {
    return new Uint8Array(0);
  }
  const reader = body.getReader();
  const buffer = new Uint8Array(limit);
  let size = 0;
  for (;;) {
    const next = yield* Effect.tryPromise({
      try: () => reader.read(),
      catch: (cause) => new CasRequestUnreadable({ cause }),
    });
    if (next.done) {
      return buffer.slice(0, size);
    }
    size += next.value.byteLength;
    if (size > limit) {
      yield* Effect.ignore(
        Effect.tryPromise({
          try: () => reader.cancel(),
          catch: (cause) => new CasRequestUnreadable({ cause }),
        })
      );
      return yield* new CasRequestTooLarge({ limit });
    }
    buffer.set(next.value, size - next.value.byteLength);
  }
});
