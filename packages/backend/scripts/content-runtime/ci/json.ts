import { createHash } from "node:crypto";
import { Effect, Schema } from "effect";
import { contentRuntimeCiError } from "./error";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export const JsonValueSchema: Schema.Schema<JsonValue> = Schema.suspend(() =>
  Schema.Union(
    Schema.Null,
    Schema.Boolean,
    Schema.JsonNumber,
    Schema.String,
    Schema.Array(JsonValueSchema),
    Schema.Record({ key: Schema.String, value: JsonValueSchema })
  )
);

export const JsonObjectSchema = Schema.Record({
  key: Schema.String,
  value: JsonValueSchema,
});

const JsonRowsTextSchema = Schema.parseJson(Schema.Array(JsonObjectSchema));

export const decodeJsonRows = (text: string) => {
  const source = text.trim().length === 0 ? "[]" : text;

  return Schema.decodeUnknown(JsonRowsTextSchema)(source).pipe(
    Effect.mapError(() =>
      contentRuntimeCiError("Production runtime data is not valid JSON rows.")
    )
  );
};

export const stripConvexSystemFields = (row: JsonObject) =>
  Object.fromEntries(
    Object.entries(row).filter(
      ([field]) => field !== "_id" && field !== "_creationTime"
    )
  );

const canonicalizeJson = (value: JsonValue): JsonValue => {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item: JsonValue) => canonicalizeJson(item));
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalizeJson(item)])
  );
};

export const hashCanonicalJson = Effect.fn("contentRuntime.hashCanonicalJson")(
  function* (value: JsonValue) {
    const encoded = JSON.stringify(canonicalizeJson(value));
    if (encoded === undefined) {
      return yield* contentRuntimeCiError(
        "Production generation data is not canonical JSON."
      );
    }

    return createHash("sha256").update(encoded).digest("hex");
  }
);
