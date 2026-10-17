import { Agent, type UsageHandler } from "@convex-dev/agent";
import {
  MAX_TITLE_LENGTH,
  NinaTitle,
} from "@repo/backend/client/nina/presentation";
import { components } from "@repo/backend/confect/_generated/components";
import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  ActionCtx,
  MutationRunner,
} from "@repo/backend/confect/_generated/services";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import { createEffectSchema } from "@repo/backend/confect/nina/contract/sdk";
import { NinaSuggestions } from "@repo/backend/confect/nina/contract/suggestions";
import type { UsageAgent } from "@repo/backend/confect/nina/contract/usage";
import {
  assembleContext,
  splitTurns,
} from "@repo/backend/confect/nina/history";
import { nakafaSuggestions } from "@repo/backend/confect/nina/prompt/suggestions";
import {
  readPromptInput,
  readRecentContext,
} from "@repo/backend/confect/nina/sealed/context";
import { Output } from "ai";
import { Effect, Schema } from "effect";

/**
 * Messages the follow-up suggestions look back on, answers included: eight
 * exchanges. A follow-up question depends on the latest answer and a few before
 * it. The call reads every message it looks back on from the database, once
 * for each completed turn, and the history budget would keep fewer than 50 of
 * them whenever the answers are long.
 */
const SUGGESTION_MESSAGES = 16;

class NinaPresentationError extends Schema.TaggedError<NinaPresentationError>()(
  "NinaPresentationError",
  { operation: Schema.Literals(["suggestions", "title"]) }
) {}

/**
 * Small Agent generations take their input from the sealed module, which reads
 * the thread and opens its rows. The Agent reads no thread messages itself, so
 * it never sees a sealed row as its skeleton.
 */
export const generatePresentation = Effect.fn("nina.presentation.generate")(
  function* (
    turn: Extract<NinaTurnsDoc, { phase: "settled" }>,
    usageHandler: UsageHandler
  ) {
    if (!turn.page) {
      return;
    }
    const ctx = yield* ActionCtx;
    const { runMutation: mutate } = yield* MutationRunner;
    const gateway = yield* Gateway;
    const options = { storageOptions: { saveMessages: "none" as const } };
    const { locale } = turn.page;
    const suggestion = gateway.language("suggestion");
    yield* readRecentContext(turn.userId, {
      excludeToolMessages: true,
      promptMessageId: turn.promptMessageId,
      recentMessages: SUGGESTION_MESSAGES,
      threadId: turn.threadId,
    }).pipe(
      Effect.mapError(
        () => new NinaPresentationError({ operation: "suggestions" })
      ),
      Effect.flatMap((context) =>
        Effect.tryPromise({
          try: (signal) =>
            new Agent(components.nina, {
              name: "suggestions" satisfies UsageAgent,
              languageModel: suggestion.model,
              usageHandler,
              instructions: nakafaSuggestions({ locale }),
              contextOptions: { recentMessages: 0 },
              // The completed turn is the newest history; the request is the new turn.
              contextHandler: () =>
                Promise.resolve(
                  assembleContext({
                    current: [
                      {
                        role: "user",
                        content:
                          "Generate follow-up suggestions for the student based on Nina's latest answer in this conversation.",
                      },
                    ],
                    history: splitTurns([
                      ...context.recent,
                      ...context.inputPrompt,
                      ...context.existingResponses,
                    ]),
                  })
                ),
            })
              .generateText(
                ctx,
                { threadId: turn.threadId, userId: turn.userId },
                {
                  promptMessageId: turn.promptMessageId,
                  abortSignal: signal,
                  output: Output.object({
                    schema: createEffectSchema(
                      Schema.Struct({ suggestions: NinaSuggestions })
                    ),
                  }),
                  timeout: suggestion.timeout,
                },
                options
              )
              .then((result) => result.output),
          catch: () => new NinaPresentationError({ operation: "suggestions" }),
        })
      ),
      Effect.flatMap((output) =>
        mutate(refs.internal.nina.presentation.save, {
          turnId: turn._id,
          suggestions: output.suggestions,
        })
      ),
      Effect.catchTag("NinaPresentationError", (error) =>
        Effect.logWarning("Nina follow-up unavailable", {
          operation: error.operation,
          turnId: turn._id,
        })
      )
    );
    if (turn.order !== 0) {
      return;
    }
    const naming = gateway.language("presentation");
    yield* readPromptInput(turn.userId, turn.promptMessageId).pipe(
      Effect.mapError(() => new NinaPresentationError({ operation: "title" })),
      Effect.flatMap((input) =>
        Effect.tryPromise({
          try: (signal) =>
            new Agent(components.nina, {
              name: "title" satisfies UsageAgent,
              languageModel: naming.model,
              usageHandler,
              instructions: `Summarize the user's opening request as a descriptive title of 3 to 5 words, at most ${MAX_TITLE_LENGTH} characters. Use the user's language. Return only the title, without quotes or colons. Do not mention internal tools or services.`,
              contextOptions: { recentMessages: 0 },
              contextHandler: () => Promise.resolve(input),
            }).generateText(
              ctx,
              { threadId: turn.threadId, userId: turn.userId },
              {
                promptMessageId: turn.promptMessageId,
                abortSignal: signal,
                timeout: naming.timeout,
              },
              options
            ),
          catch: () => new NinaPresentationError({ operation: "title" }),
        })
      ),
      Effect.flatMap(({ text }) =>
        Schema.decodeEffect(NinaTitle)(text).pipe(
          Effect.mapError(
            () => new NinaPresentationError({ operation: "title" })
          )
        )
      ),
      Effect.flatMap((value) =>
        mutate(refs.internal.nina.presentation.save, {
          turnId: turn._id,
          title: value,
        })
      ),
      Effect.catchTag("NinaPresentationError", (error) =>
        Effect.logWarning("Nina title unavailable", {
          operation: error.operation,
          turnId: turn._id,
        })
      )
    );
  }
);
