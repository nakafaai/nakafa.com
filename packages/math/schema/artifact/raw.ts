import { Effect, Schema } from "effect";

/** Expected failure raised when raw artifact preflight cannot read JSON size. */
export class ArtifactSafetyReadError extends Schema.TaggedError<ArtifactSafetyReadError>()(
  "ArtifactSafetyReadError",
  {
    message: Schema.String,
  }
) {}

/**
 * Counts producer data bytes without invoking user-defined toJSON hooks.
 */
export function readRawJsonByteCount(
  value: unknown,
  seenObjects: WeakSet<object>,
  limits: { readonly arrayItems: number; readonly bytes: number }
): Effect.Effect<number | undefined, ArtifactSafetyReadError> {
  return Effect.gen(function* () {
    if (value === undefined) {
      return;
    }

    if (value === null) {
      return 4;
    }

    if (typeof value === "string") {
      return new TextEncoder().encode(JSON.stringify(value)).byteLength;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return new TextEncoder().encode(String(value)).byteLength;
    }

    if (typeof value === "symbol" || typeof value === "function") {
      return;
    }

    if (seenObjects.has(value)) {
      return yield* Effect.fail(
        new ArtifactSafetyReadError({
          message: "Invalid learning artifact contract.",
        })
      );
    }
    seenObjects.add(value);

    const sizeBytes = Array.isArray(value)
      ? yield* readRawArrayJsonByteCount(value, seenObjects, limits)
      : yield* readRawObjectJsonByteCount(value, seenObjects, limits);
    seenObjects.delete(value);

    return sizeBytes;
  });
}

/**
 * Reads a producer-controlled property through the typed Effect error path.
 */
export const readRawField = Effect.fn("math.artifact.raw.readField")(function* (
  source: unknown,
  field: string
) {
  return yield* Effect.try({
    catch: () =>
      new ArtifactSafetyReadError({
        message: "Invalid learning artifact contract.",
      }),
    try: () => (isObjectLike(source) ? Reflect.get(source, field) : undefined),
  });
});

/**
 * Reads and bounds an array length once before iterating raw slots.
 */
export const readRawArrayCount = Effect.fn("math.artifact.raw.readArrayCount")(
  function* (value: unknown, label: string, limit: number) {
    if (!Array.isArray(value)) {
      return;
    }

    const length = yield* readRawField(value, "length");
    if (
      typeof length !== "number" ||
      !Number.isSafeInteger(length) ||
      length < 0
    ) {
      return yield* Effect.fail(
        new ArtifactSafetyReadError({
          message: "Invalid learning artifact contract.",
        })
      );
    }

    return length > limit ? `${label} exceeds ${limit} items.` : length;
  }
);

/**
 * Reads one raw array slot through the same typed property boundary as fields.
 */
export const readRawArrayItem = Effect.fn("math.artifact.raw.readArrayItem")(
  function* (value: readonly unknown[], index: number) {
    return yield* readRawField(value, `${index}`);
  }
);

/**
 * Counts array payload bytes from a checked length snapshot.
 */
function readRawArrayJsonByteCount(
  value: readonly unknown[],
  seenObjects: WeakSet<object>,
  limits: { readonly arrayItems: number; readonly bytes: number }
): Effect.Effect<number | undefined, ArtifactSafetyReadError> {
  return Effect.gen(function* () {
    const length = yield* readKnownRawArrayLength(value);
    if (length > limits.arrayItems) {
      return limits.bytes + 1;
    }

    let sizeBytes = 2;
    for (let index = 0; index < length; index += 1) {
      const item = yield* readRawArrayItem(value, index);
      const itemBytes = yield* readRawJsonByteCount(item, seenObjects, limits);
      sizeBytes += itemBytes ?? 4;
      if (index > 0) {
        sizeBytes += 1;
      }
      if (sizeBytes > limits.bytes) {
        return sizeBytes;
      }
    }

    return sizeBytes;
  });
}

/**
 * Reads a known array's length once for byte traversal snapshots.
 */
const readKnownRawArrayLength = Effect.fn(
  "math.artifact.raw.readKnownArrayLength"
)(function* (value: readonly unknown[]) {
  const length = yield* readRawField(value, "length");
  if (
    typeof length !== "number" ||
    !Number.isSafeInteger(length) ||
    length < 0
  ) {
    return yield* Effect.fail(
      new ArtifactSafetyReadError({
        message: "Invalid learning artifact contract.",
      })
    );
  }

  return length;
});

/**
 * Counts object payload bytes from enumerable own fields without toJSON.
 */
function readRawObjectJsonByteCount(
  value: object,
  seenObjects: WeakSet<object>,
  limits: { readonly arrayItems: number; readonly bytes: number }
): Effect.Effect<number | undefined, ArtifactSafetyReadError> {
  return Effect.gen(function* () {
    const keys = yield* Effect.try({
      catch: () =>
        new ArtifactSafetyReadError({
          message: "Invalid learning artifact contract.",
        }),
      try: () => Object.keys(value),
    });

    let sizeBytes = 2;
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      const fieldValue = yield* readRawField(value, key);
      const fieldBytes = yield* readRawJsonByteCount(
        fieldValue,
        seenObjects,
        limits
      );
      if (fieldBytes === undefined) {
        continue;
      }

      sizeBytes += new TextEncoder().encode(JSON.stringify(key)).byteLength;
      sizeBytes += 1 + fieldBytes;
      if (index > 0) {
        sizeBytes += 1;
      }
      if (sizeBytes > limits.bytes) {
        return sizeBytes;
      }
    }

    return sizeBytes;
  });
}

/**
 * Narrows values whose properties may be inspected with Reflect.get.
 */
function isObjectLike(value: unknown): value is object {
  return (
    (typeof value === "object" || typeof value === "function") && value !== null
  );
}
