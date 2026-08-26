import { fromJsonSchema } from "@modelcontextprotocol/server";
import { Schema } from "effect";

/** Exposes one Effect runtime contract as an inferred MCP Standard Schema. */
export function toMcpSchema<Source extends Schema.Constraint>(source: Source) {
  const document = Schema.toJsonSchemaDocument(source);
  return fromJsonSchema<Schema.Schema.Type<Source>>({
    $defs: document.definitions,
    allOf: [document.schema],
  });
}
