import { NakafaAgentContentRefSchema } from "@repo/contents/_lib/agent/schema/ref";
import { Schema } from "effect";

/** Shared content reference input accepted by Nakafa agent lookup tools. */
export const NakafaAgentContentRefInputSchema = Schema.NonEmptyString.pipe(
  Schema.brand("@Nakafa/AgentContentRefInput")
).annotations({
  description:
    "Nakafa content reference: a content_id returned by search, a canonical Nakafa URL, or a nakafa://content/... resource URI.",
});

/** Runtime schema for full content read input. */
export const NakafaAgentReadOptionsSchema = Schema.Struct({
  content_ref: NakafaAgentContentRefInputSchema,
})
  .pipe(Schema.mutable)
  .annotations({ description: "Nakafa content read options." });

/** Runtime schema for markdown retrieval output. */
export const NakafaAgentMarkdownSchema = NakafaAgentContentRefSchema.pipe(
  Schema.extend(
    Schema.Struct({
      description: Schema.String.annotations({
        description: "Short content description.",
      }),
      text: Schema.String.annotations({
        description: "Full agent-readable markdown text.",
      }),
      title: Schema.String.annotations({
        description: "Human-readable content title.",
      }),
    })
  ),
  Schema.mutable
).annotations({ description: "Full Nakafa content markdown payload." });

export type NakafaAgentReadOptions = Schema.Schema.Type<
  typeof NakafaAgentReadOptionsSchema
>;
export type NakafaAgentContentRefInput = Schema.Schema.Type<
  typeof NakafaAgentContentRefInputSchema
>;
export type NakafaAgentMarkdown = Schema.Schema.Type<
  typeof NakafaAgentMarkdownSchema
>;
