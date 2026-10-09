import {
  Cause,
  Effect,
  Array as EffectArray,
  MutableList,
  Schema,
  Stream,
} from "effect";

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
/** Acquires one reader in the typed channel and cancels it when its stream ends. */
function streamBody(body: ReadableStream<Uint8Array>) {
  return Stream.fromPull(
    Effect.acquireRelease(
      Effect.try({
        catch: () => BodyReadError.make(),
        try: () => body.getReader(),
      }),
      (reader) =>
        Effect.tryPromise({
          catch: () => undefined,
          try: () => reader.cancel(),
        }).pipe(Effect.ignore)
    ).pipe(
      Effect.map((reader) =>
        Effect.tryPromise({
          catch: () => BodyReadError.make(),
          try: () => reader.read(),
        }).pipe(
          Effect.flatMap(({ done, value }) =>
            done ? Cause.done() : Effect.succeed(EffectArray.of(value))
          )
        )
      )
    )
  ).pipe(Stream.scoped);
}
/** Parses an optional decimal Content-Length without unsafe number coercion. */
export const parseContentLength = Effect.fn("Utilities.parseContentLength")(
  function* (value: string | null, maxBytes: number) {
    if (value === null) {
      return null;
    }
    if (!DECIMAL_BYTES.test(value)) {
      return yield* BodyLengthError.make({ reason: "invalid" });
    }
    const byteLength = Number(value);
    if (!Number.isSafeInteger(byteLength)) {
      return yield* BodyLengthError.make({ reason: "invalid" });
    }
    if (byteLength > maxBytes) {
      return yield* BodyLengthError.make({ reason: "limit" });
    }
    return byteLength;
  }
);
/** Collects a byte stream into one array and fails once it crosses its ceiling. */
export const readBoundedStream = Effect.fn("Utilities.readBoundedStream")(
  function* <Failure, Requirements>(
    stream: Stream.Stream<Uint8Array, Failure, Requirements>,
    maxBytes: number
  ) {
    // Chunks grow in place, so reading a body stays linear in its size.
    const chunks = MutableList.make<Uint8Array>();
    const totalBytes = yield* stream.pipe(
      Stream.runFoldEffect(
        () => 0,
        (current, chunk) => {
          const nextTotal = current + chunk.byteLength;
          if (nextTotal > maxBytes) {
            return Effect.fail(
              BodyLimitError.make({ actualBytes: nextTotal, maxBytes })
            );
          }
          MutableList.append(chunks, chunk);
          return Effect.succeed(nextTotal);
        }
      )
    );
    return concatenateChunks(MutableList.toArray(chunks), totalBytes);
  }
);
/** Reads a web body stream with typed failure and interruption cancellation. */
export const readBoundedBody = Effect.fn("Utilities.readBoundedBody")(
  function* (body: ReadableStream<Uint8Array> | null, maxBytes: number) {
    if (body === null) {
      return yield* BodyMissingError.make();
    }
    return yield* readBoundedStream(streamBody(body), maxBytes);
  }
);
