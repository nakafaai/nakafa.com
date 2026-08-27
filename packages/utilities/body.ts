import { Effect, Schema, Stream } from "effect";

const DECIMAL_BYTES = /^\d+$/u;
/** A request or response omitted the readable body required by its contract. */
export class BodyMissingError extends Schema.TaggedError<BodyMissingError>()(
  "BodyMissingError",
  {}
) {}
/** A web body reader failed before the complete payload was available. */
export class BodyReadError extends Schema.TaggedError<BodyReadError>()(
  "BodyReadError",
  {}
) {}
/** A streamed web body crossed its caller-owned byte ceiling. */
export class BodyLimitError extends Schema.TaggedError<BodyLimitError>()(
  "BodyLimitError",
  {
    actualBytes: Schema.Finite.pipe(
      Schema.check(Schema.isInt()),
      Schema.check(Schema.isGreaterThan(0))
    ),
    maxBytes: Schema.Finite.pipe(
      Schema.check(Schema.isInt()),
      Schema.check(Schema.isGreaterThan(0))
    ),
  }
) {}
/** A Content-Length value is malformed or exceeds its caller-owned ceiling. */
export class BodyLengthError extends Schema.TaggedError<BodyLengthError>()(
  "BodyLengthError",
  {
    reason: Schema.Literals(["invalid", "limit"]),
  }
) {}
/** Copies ordered chunks into one exactly sized byte array. */
function concatenateChunks(chunks: readonly Uint8Array[], totalBytes: number) {
  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
interface BoundedBodyState {
  readonly chunks: Uint8Array[];
  readonly totalBytes: number;
}
/** Parses an optional decimal Content-Length without unsafe number coercion. */
export const parseContentLength = Effect.fn("Utilities.parseContentLength")(
  function* (value: string | null, maxBytes: number) {
    if (value === null) {
      return null;
    }
    if (!DECIMAL_BYTES.test(value)) {
      return yield* new BodyLengthError({ reason: "invalid" });
    }
    const byteLength = Number(value);
    if (!Number.isSafeInteger(byteLength)) {
      return yield* new BodyLengthError({ reason: "invalid" });
    }
    if (byteLength > maxBytes) {
      return yield* new BodyLengthError({ reason: "limit" });
    }
    return byteLength;
  }
);
/** Reads a web body stream with typed failure and interruption cancellation. */
export const readBoundedBody = Effect.fn("Utilities.readBoundedBody")(
  function* (body: ReadableStream<Uint8Array> | null, maxBytes: number) {
    if (body === null) {
      return yield* new BodyMissingError();
    }
    if (body.locked) {
      return yield* new BodyReadError();
    }
    const state = yield* Stream.fromReadableStream({
      evaluate: () => body,
      onError: () => new BodyReadError(),
    }).pipe(
      Stream.runFoldEffect(
        (): BoundedBodyState => ({ chunks: [], totalBytes: 0 }),
        (current, chunk) => {
          const totalBytes = current.totalBytes + chunk.byteLength;
          if (totalBytes > maxBytes) {
            return Effect.fail(
              new BodyLimitError({ actualBytes: totalBytes, maxBytes })
            );
          }
          current.chunks.push(chunk);
          return Effect.succeed({ chunks: current.chunks, totalBytes });
        }
      )
    );
    return concatenateChunks(state.chunks, state.totalBytes);
  }
);
