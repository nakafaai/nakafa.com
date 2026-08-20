import {
  NakafaAgentContentIdSchema,
  NakafaAgentContentUrlSchema,
  NakafaAgentReadableContentRefSchema,
} from "@repo/contents/_lib/agent/schema/ref";
import { Schema, Struct } from "effect";

const CONTENT_RESOURCE_PREFIX = "nakafa://content/";
/** Checks whether a string is a graph content ID, resource URI, or URL projection. */
function isNakafaContentRefInput(value: string) {
  const trimmed = value.trim();
  return (
    Schema.is(NakafaAgentContentIdSchema)(trimmed) ||
    Schema.is(NakafaAgentContentUrlSchema)(trimmed) ||
    isNakafaContentResourceUri(trimmed)
  );
}
/** Checks whether a string is a Nakafa content resource URI. */
function isNakafaContentResourceUri(value: string) {
  if (!value.startsWith(CONTENT_RESOURCE_PREFIX)) {
    return false;
  }
  const contentId = value
    .slice(CONTENT_RESOURCE_PREFIX.length)
    .replaceAll("%2F", "/")
    .replaceAll("%2f", "/");
  return Schema.is(NakafaAgentContentIdSchema)(contentId);
}
/** Shared content reference input accepted by Nakafa agent lookup tools. */
export const NakafaAgentContentRefInputSchema = Schema.NonEmptyString.pipe(
  Schema.check(
    Schema.makeFilter(isNakafaContentRefInput, {
      message:
        "Expected a Nakafa graph content ID, resource URI, or canonical URL.",
    })
  ),
  Schema.brand("@Nakafa/AgentContentRefInput")
).annotate({
  description:
    "Nakafa content reference: a content_id returned by search, a canonical Nakafa URL, or a nakafa://content/... resource URI.",
});
/** Runtime schema for full content read input. */
export const NakafaAgentReadOptionsSchema = Schema.Struct({
  content_ref: NakafaAgentContentRefInputSchema,
})
  .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  .annotate({ description: "Nakafa content read options." });
/** Runtime schema for markdown retrieval output. */
export const NakafaAgentMarkdownSchema =
  NakafaAgentReadableContentRefSchema.mapFields(
    (fields) => ({
      ...fields,
      description: Schema.optional(
        Schema.String.annotate({
          description:
            "Short content description when signed metadata provides one.",
        })
      ),
      text: Schema.String.annotate({
        description: "Full agent-readable markdown text.",
      }),
      title: Schema.String.annotate({
        description: "Human-readable content title.",
      }),
    }),
    { unsafePreserveChecks: true }
  )
    .mapFields(Struct.map(Schema.mutableKey), { unsafePreserveChecks: true })
    .annotate({ description: "Full Nakafa content markdown payload." });
export type NakafaAgentReadOptions = Schema.Schema.Type<
  typeof NakafaAgentReadOptionsSchema
>;
export type NakafaAgentContentRefInput = Schema.Schema.Type<
  typeof NakafaAgentContentRefInputSchema
>;
export type NakafaAgentMarkdown = Schema.Schema.Type<
  typeof NakafaAgentMarkdownSchema
>;
