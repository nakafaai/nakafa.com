import { Agent } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import { ActionCtx } from "@repo/backend/confect/_generated/services";
import { createCapabilities } from "@repo/backend/confect/nina/capabilities";
import { inNewChatStep } from "@repo/backend/test/nina/deadline";
import { providerStep } from "@repo/backend/test/nina/specialist";
import { encodeJsonText } from "@repo/utilities/json";
import { isStepCount } from "ai";
import type { MockLanguageModelV4 } from "ai/test";
import {
  Array as Arr,
  Effect,
  Logger,
  MutableHashMap,
  MutableRef,
} from "effect";

/** One step of a scripted model that calls a capability with an input. */
export function toolCall(
  toolName: string,
  input: object,
  toolCallId = "capability"
) {
  return providerStep(
    [
      {
        type: "tool-call",
        toolName,
        toolCallId,
        input: encodeJsonText(input),
      },
    ],
    "tool-calls"
  );
}

/**
 * Plays a scripted model through the real Agent, with the capability tools of
 * one learner, and returns what its tool calls produced and what the turn
 * logged. The memory tool leaves the words it finds in `found`, as in a turn.
 */
export function playTurn({
  context,
  found = MutableHashMap.empty<string, string>(),
  model,
  prompt,
  userId,
}: {
  readonly context: Parameters<typeof createCapabilities>[1];
  readonly found?: Parameters<typeof createCapabilities>[4];
  readonly model: MockLanguageModelV4;
  readonly prompt: string;
  readonly userId: Parameters<typeof createCapabilities>[0];
}) {
  const logged = MutableRef.make<readonly unknown[]>([]);
  return Effect.gen(function* () {
    const tools = yield* createCapabilities(
      userId,
      context,
      "en",
      vi.fn(),
      found
    );
    const ctx = yield* ActionCtx;
    const generated = yield* Effect.promise(() =>
      new Agent(components.nina, {
        name: "test",
        languageModel: model,
        tools,
        stopWhen: isStepCount(3),
      }).generateText(ctx, { userId }, { prompt })
    );
    return {
      logged,
      result: Arr.map(generated.toolResults, ({ output }) => output),
    };
  }).pipe(
    inNewChatStep,
    Effect.provide(
      Logger.layer([
        Logger.formatStructured.pipe(
          Logger.map(({ message }) =>
            MutableRef.update(logged, Arr.append(message))
          )
        ),
      ])
    )
  );
}
