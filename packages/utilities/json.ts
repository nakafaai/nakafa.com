import { Schema } from "effect";

/** Decodes JSON text into an unknown value and encodes any value back into JSON text. */
export const JsonTextSchema = Schema.fromJsonString(Schema.Unknown);

/** Encodes any value into JSON text; throws when the value cannot be serialized. */
export const encodeJsonText = Schema.encodeSync(JsonTextSchema);

/** Encodes any value into JSON text indented by two spaces; throws when the value cannot be serialized. */
export const encodePrettyJsonText = Schema.encodeSync(
  Schema.fromJsonString(Schema.Unknown, { space: 2 })
);
