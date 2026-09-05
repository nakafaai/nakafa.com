import { createHash } from "node:crypto";
import { contentSnapshotError } from "@repo/backend/content/snapshot/error";
import { Effect, Schema } from "effect";
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | {
      readonly [key: string]: JsonValue;
    };
export interface JsonObject {
  readonly [key: string]: JsonValue;
}
export const JsonValueSchema: Schema.Codec<JsonValue> = Schema.suspend(() =>
  Schema.Union([
    Schema.Null,
    Schema.Boolean,
    Schema.Finite,
    Schema.String,
    Schema.Array(JsonValueSchema),
    Schema.Record(Schema.String, JsonValueSchema),
  ])
);
export const JsonObjectSchema = Schema.Record(Schema.String, JsonValueSchema);
const JsonRowsTextSchema = Schema.fromJsonString(
  Schema.Array(JsonObjectSchema)
);
export const decodeJsonRows = (text: string) => {
  const source = text.trim().length === 0 ? "[]" : text;
  return Schema.decodeEffect(JsonRowsTextSchema)(source).pipe(
    Effect.mapError(() =>
      contentSnapshotError("Production runtime data is not valid JSON rows.")
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
  (value: JsonValue) =>
    Effect.sync(() => {
      const encoded = JSON.stringify(canonicalizeJson(value));
      return createHash("sha256").update(encoded).digest("hex");
    })
);
