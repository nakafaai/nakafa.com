import { CapabilityOutputSchema } from "@repo/backend/confect/nina/capability/progress";
import { LearningCapabilityNameSchema } from "@repo/backend/confect/nina/capability/spec";
import { type ModelMessage, pruneMessages } from "ai";
import { Effect, Schema } from "effect";
import { isWithinTokenLimit } from "gpt-tokenizer";

const CONTEXT_TOKEN_LIMIT = 24_000;

export class NinaContextLimitError extends Schema.TaggedError<NinaContextLimitError>()(
  "NinaContextLimitError",
  { message: Schema.String }
) {}

/** Keep model evidence compact while Agent's stored result retains every card. */
export const boundHistory = Effect.fn("nina.history.bound")(function* (
  messages: ModelMessage[]
) {
  const projected: ModelMessage[] = yield* Effect.forEach(
    messages,
    Effect.fn(function* (message) {
      if (message.role !== "tool") {
        return message;
      }
      const content = yield* Effect.forEach(
        message.content,
        Effect.fn(function* (part) {
          if (
            part.type !== "tool-result" ||
            part.output.type !== "json" ||
            !(
              Schema.is(LearningCapabilityNameSchema)(part.toolName) ||
              Schema.is(CapabilityOutputSchema)(part.output.value)
            )
          ) {
            return part;
          }
          const evidence = yield* Schema.decodeUnknownEffect(
            CapabilityOutputSchema
          )(part.output.value).pipe(
            Effect.mapError(
              () =>
                new NinaContextLimitError({
                  message:
                    "Stored Nina evidence does not satisfy its contract.",
                })
            )
          );
          return {
            ...part,
            output: { type: "text" as const, value: evidence.text },
          };
        })
      );
      return { ...message, content };
    })
  );
  let retained = pruneMessages({
    messages: projected,
    reasoning: "all",
    emptyMessages: "remove",
  });
  while (
    retained.length > 50 ||
    !isWithinTokenLimit(JSON.stringify(retained), CONTEXT_TOKEN_LIMIT)
  ) {
    const nextPrompt = retained.findIndex(
      (message, index) => index > 0 && message.role === "user"
    );
    if (nextPrompt < 0) {
      return yield* new NinaContextLimitError({
        message:
          "The latest prompt and its evidence exceed Nina's context limit.",
      });
    }
    retained = retained.slice(nextPrompt);
  }
  return retained;
});
