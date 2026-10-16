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

/** Small Agent generations use the existing thread as context without adding messages. */
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
    const suggestion = gateway.language("suggestion");
    const suggestions = new Agent(components.nina, {
      name: "suggestions" satisfies UsageAgent,
      languageModel: suggestion.model,
      usageHandler,
      instructions: nakafaSuggestions({ locale: turn.page.locale }),
      contextOptions: {
        recentMessages: SUGGESTION_MESSAGES,
        excludeToolMessages: true,
      },
      // The completed turn is the newest history; the request is the new turn.
      contextHandler: (_ctx, fetched) =>
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
              ...fetched.recent,
              ...fetched.inputPrompt,
              ...fetched.existingResponses,
            ]),
          })
        ),
    });
    const options = { storageOptions: { saveMessages: "none" as const } };
    yield* Effect.tryPromise({
      try: (signal) =>
        suggestions
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
    }).pipe(
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
    const title = new Agent(components.nina, {
      name: "title" satisfies UsageAgent,
      languageModel: naming.model,
      usageHandler,
      instructions: `Summarize the user's opening request as a descriptive title of 3 to 5 words, at most ${MAX_TITLE_LENGTH} characters. Use the user's language. Return only the title, without quotes or colons. Do not mention internal tools or services.`,
      contextOptions: { recentMessages: 50 },
      contextHandler: (_ctx, { inputPrompt }) => Promise.resolve(inputPrompt),
    });
    yield* Effect.tryPromise({
      try: (signal) =>
        title.generateText(
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
    }).pipe(
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
