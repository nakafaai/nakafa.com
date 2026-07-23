import { Effect, Schema } from "effect";

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
    actualBytes: Schema.Number.pipe(Schema.int(), Schema.positive()),
    maxBytes: Schema.Number.pipe(Schema.int(), Schema.positive()),
  }
) {}

/** A Content-Length value is malformed or exceeds its caller-owned ceiling. */
export class BodyLengthError extends Schema.TaggedError<BodyLengthError>()(
  "BodyLengthError",
  {
    reason: Schema.Literal("invalid", "limit"),
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

/** Settles provider cancellation without hiding the primary body failure. */
function cancelReader(reader: ReadableStreamDefaultReader<Uint8Array>) {
  reader.cancel().then(
    () => undefined,
    () => undefined
  );
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

/** Reads a web body stream without buffering beyond the declared limit. */
export const readBoundedBody = Effect.fn("Utilities.readBoundedBody")(
  function* (body: ReadableStream<Uint8Array> | null, maxBytes: number) {
    if (!body) {
      return yield* new BodyMissingError();
    }
    const reader = yield* Effect.try({
      catch: () => new BodyReadError(),
      try: () => body.getReader(),
    });

    return yield* Effect.async<Uint8Array, BodyLimitError | BodyReadError>(
      (resume) => {
        const chunks: Uint8Array[] = [];
        let totalBytes = 0;

        /** Pulls one provider chunk and completes through the Effect callback. */
        function pull() {
          reader.read().then(
            ({ done, value }) => {
              if (done) {
                resume(Effect.succeed(concatenateChunks(chunks, totalBytes)));
                return;
              }
              totalBytes += value.byteLength;
              if (totalBytes > maxBytes) {
                cancelReader(reader);
                resume(
                  Effect.fail(
                    new BodyLimitError({ actualBytes: totalBytes, maxBytes })
                  )
                );
                return;
              }
              chunks.push(value);
              pull();
            },
            () => resume(Effect.fail(new BodyReadError()))
          );
        }

        pull();

        return Effect.sync(() => cancelReader(reader));
      }
    );
  }
);
