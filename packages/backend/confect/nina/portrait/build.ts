import { Agent } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  ActionCtx,
  MutationRunner,
} from "@repo/backend/confect/_generated/services";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import { createEffectSchema } from "@repo/backend/confect/nina/contract/sdk";
import {
  generationFailure,
  logFailure,
  NinaMemoryError,
} from "@repo/backend/confect/nina/memory/failure";
import {
  formatPortraitPrompt,
  PORTRAIT_INSTRUCTIONS,
} from "@repo/backend/confect/nina/portrait/prompt";
import { NinaPortraitDraft } from "@repo/backend/confect/nina/portrait/schema";
import { Output } from "ai";
import { Array as Arr, Effect, Struct } from "effect";

/**
 * Asks the model for the new portrait text from the portrait as it stands and
 * the memories it has not read, and returns it with the tokens the call spent.
 * The call is on the background purpose, so it carries the retention flags of
 * every language model call, and it saves no message. An answer that does not
 * fit the portrait object, such as one over the length limit, is rejected and
 * nothing is saved.
 */
const writePortrait = Effect.fn("nina.portrait.write")(function* (
  userId: Docs["users"]["_id"],
  prompt: string
) {
  const ctx = yield* ActionCtx;
  const handle = (yield* Gateway).language("background");
  const agent = new Agent(components.nina, {
    instructions: PORTRAIT_INSTRUCTIONS,
    languageModel: handle.model,
    name: "portrait",
  });
  return yield* Effect.tryPromise({
    try: (signal) =>
      agent
        .generateText(
          ctx,
          { userId },
          {
            abortSignal: signal,
            output: Output.object({
              schema: createEffectSchema(NinaPortraitDraft),
            }),
            prompt,
            timeout: handle.timeout,
          },
          { storageOptions: { saveMessages: "none" } }
        )
        .then(({ output, usage }) => ({
          text: output.portrait,
          usage: {
            input: usage.inputTokens ?? 0,
            output: usage.outputTokens ?? 0,
          },
        })),
    catch: generationFailure,
  });
});

/**
 * Builds the portrait of a learner in the background, when a request has had
 * its quiet (`claimPortrait`). Nothing waits for it: a request schedules it
 * after a delay. The model gets the portrait as it stands and the lasting
 * memories confirmed after it, and writes the whole new text, which
 * `savePortrait` stores only if nothing changed meanwhile. A build with no
 * memory newer than the portrait asks no model. Whatever fails, the portrait
 * stays as it was: the failure is logged and the next request asks again after
 * a day.
 */
export const buildPortrait = Effect.fn("nina.portrait.build")(
  function* (userId: Docs["users"]["_id"]) {
    const claim = yield* (yield* MutationRunner)
      .runMutation(refs.internal.nina.portrait.claim, { userId })
      .pipe(Effect.orDie);
    if (claim === null) {
      return;
    }
    const { memories, portrait, reached, through } = claim;
    if (
      Arr.isReadonlyArrayEmpty(memories) &&
      reached === through &&
      portrait !== undefined
    ) {
      return;
    }
    const written = Arr.isReadonlyArrayNonEmpty(memories)
      ? yield* writePortrait(userId, formatPortraitPrompt(portrait, memories))
      : undefined;
    yield* (yield* MutationRunner)
      .runMutation(refs.internal.nina.portrait.save, {
        expected: through,
        memories: Arr.map(memories, Struct.pick(["confirmedAt", "id"])),
        reached,
        ...(written === undefined ? {} : written),
        userId,
      })
      .pipe(Effect.orDie);
  },
  Effect.catchDefect(() =>
    Effect.fail(new NinaMemoryError({ operation: "unknown", rejected: false }))
  ),
  Effect.catchTag("NinaMemoryError", (error) =>
    logFailure("Nina portrait unavailable", error)
  )
);
