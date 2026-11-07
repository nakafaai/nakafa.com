import { Agent, type UsageHandler } from "@convex-dev/agent";
import {
  MAX_TITLE_LENGTH,
  NinaTitle,
} from "@repo/backend/client/nina/presentation";
import { components } from "@repo/backend/confect/_generated/components";
import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import ninaInternal from "@repo/backend/confect/_generated/refs/nina.server";
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
import { Array as Arr, Effect, Option, Schema, Stream } from "effect";

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

/** The failure of the follow-ups, which the turn logs and goes on without. */
const suggestionsUnavailable = () =>
  new NinaPresentationError({ operation: "suggestions" });

/** The follow-ups the model returns, as one object so the output can be parsed while it streams. */
const suggestionsOutput = createEffectSchema(
  Schema.Struct({ suggestions: NinaSuggestions })
);

/** A partial output that has begun its list of follow-ups. */
const PartialSuggestions = Schema.Struct({
  suggestions: Schema.Array(Schema.Unknown),
});

/**
 * The follow-ups of a partial output that the model has finished writing: every
 * one before the last, which may still grow. They are kept only when they hold
 * as saved follow-ups, so a learner never sees half a question.
 */
const readWrittenSuggestions = (partial: unknown) =>
  Schema.decodeUnknownOption(PartialSuggestions)(partial).pipe(
    Option.flatMap(({ suggestions }) =>
      Schema.decodeUnknownOption(NinaSuggestions)(Arr.dropRight(suggestions, 1))
    )
  );

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
      Effect.mapError(suggestionsUnavailable),
      Effect.flatMap((context) =>
        Effect.gen(function* () {
          // A provider that refuses the call closes the partial stream and
          // never settles `output`, so the stream's own error is the signal.
          let failed = false;
          const result = yield* Effect.tryPromise({
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
              }).streamText(
                ctx,
                { threadId: turn.threadId, userId: turn.userId },
                {
                  promptMessageId: turn.promptMessageId,
                  abortSignal: signal,
                  output: Output.object({ schema: suggestionsOutput }),
                  timeout: suggestion.timeout,
                  onError: () => {
                    failed = true;
                  },
                },
                options
              ),
            catch: suggestionsUnavailable,
          });
          // Each follow-up is saved once the model has moved on to the next
          // one, so the learner reads them arrive one by one through the turn's
          // own query; the last one is whole only when the model has finished.
          yield* Stream.fromAsyncIterable(
            result.partialOutputStream,
            suggestionsUnavailable
          ).pipe(
            Stream.map(readWrittenSuggestions),
            Stream.filter(Option.isSome),
            Stream.map((written) => written.value),
            Stream.changesWith(
              (before, after) => before.length === after.length
            ),
            Stream.runForEach((suggestions) =>
              mutate(ninaInternal.presentation.save, {
                turnId: turn._id,
                suggestions,
              })
            )
          );
          if (failed) {
            return yield* suggestionsUnavailable();
          }
          return yield* Effect.tryPromise({
            try: () => result.output,
            catch: suggestionsUnavailable,
          });
        })
      ),
      Effect.flatMap((output) =>
        mutate(ninaInternal.presentation.save, {
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
        mutate(ninaInternal.presentation.save, {
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
