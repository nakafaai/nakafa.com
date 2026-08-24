import { fromJsonSchema } from "@modelcontextprotocol/server";
import { Schema } from "effect";

/** Exposes one Effect runtime contract as an MCP Standard Schema. */
export function toMcpSchema<Value>(schema: Schema.Constraint) {
  const document = Schema.toJsonSchemaDocument(schema);
  const jsonSchema = {
    $defs: document.definitions,
    allOf: [document.schema],
  };
  return fromJsonSchema<Value>(jsonSchema);
}
