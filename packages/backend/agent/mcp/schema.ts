import { fromJsonSchema } from "@modelcontextprotocol/server";
import { Schema } from "effect";

/** Exposes one object-rooted Effect contract as an inferred MCP schema. */
export function toMcpObjectSchema<
  Source extends Schema.ConstraintCodec<object, object, unknown, unknown>,
>(source: Source) {
  const document = Schema.toJsonSchemaDocument(source);
  return fromJsonSchema<Schema.Schema.Type<Source>>({
    $defs: document.definitions,
    ...document.schema,
    type: "object",
  });
}
