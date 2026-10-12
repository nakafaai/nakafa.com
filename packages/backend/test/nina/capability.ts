import { Agent } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import { ActionCtx } from "@repo/backend/confect/_generated/services";
import {
  CapabilityTurn,
  createCapabilities,
} from "@repo/backend/confect/nina/capability/define";
import { ninaStream, ninaUsage } from "@repo/backend/test/nina";
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
  Result,
  Schema,
  Stream,
} from "effect";

/** A scripted stream that failed while it was read. */
class ScriptedStreamError extends Schema.TaggedError<ScriptedStreamError>()(
  "ScriptedStreamError",
  { cause: Schema.Unknown }
) {}

/** The last step of a scripted model, which answers once its tool call returned. */
export const finalAnswer = providerStep([
  { type: "text", text: "Answer from tool evidence." },
]);

/** One step of a scripted model: a call of the tool `toolName` with `input`. */
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
 * The same two steps as a stream: a call of the tool `toolName` with `input`,
 * and then an answer. A stream shows the progress of a tool before it ends.
 */
export function streamedToolCall(toolName: string, input: object) {
  return [
    ninaStream([
      { type: "stream-start", warnings: [] },
      {
        type: "tool-call",
        toolCallId: "capability",
        toolName,
        input: encodeJsonText(input),
      },
      {
        type: "finish",
        usage: ninaUsage,
        finishReason: { unified: "tool-calls", raw: "tool-calls" },
      },
    ]),
    ninaStream([
      { type: "stream-start", warnings: [] },
      { type: "text-start", id: "answer" },
      { type: "text-delta", id: "answer", delta: "Answer from tool evidence." },
      { type: "text-end", id: "answer" },
      {
        type: "finish",
        usage: ninaUsage,
        finishReason: { unified: "stop", raw: "stop" },
      },
    ]),
  ];
}

/**
 * The facts of the turn that a scripted model plays in, as the turn gives them
 * to the tools: the learner, the context, and the held answers. The tools of a
 * capability that declares a note leave its words in `held`, as in a turn.
 */
function turnOf({
  context,
  held = MutableHashMap.empty(),
  userId,
}: Pick<CapabilityTurn["Service"], "context" | "userId"> &
  Partial<Pick<CapabilityTurn["Service"], "held">>) {
  return {
    context,
    held,
    locale: "en",
    usageHandler: vi.fn(),
    userId,
  } satisfies CapabilityTurn["Service"];
}

/**
 * Plays a scripted model through the real Agent, with the tools that a registry
 * builds for one learner, and returns what its tool calls produced, the errors
 * of the calls that ended in one, and what the turn logged. `chatStep` is the
 * chat step the tools run in: a new one, by default.
 */
export function playTurn({
  chatStep = inNewChatStep,
  model,
  prompt,
  registry,
  ...turn
}: {
  readonly chatStep?: typeof inNewChatStep;
  readonly model: MockLanguageModelV4;
  readonly prompt: string;
  readonly registry: Parameters<typeof createCapabilities>[0];
} & Parameters<typeof turnOf>[0]) {
  const logged = MutableRef.make<readonly unknown[]>([]);
  return Effect.gen(function* () {
    const tools = yield* createCapabilities(registry).pipe(
      Effect.provideService(CapabilityTurn, turnOf(turn))
    );
    const ctx = yield* ActionCtx;
    const generated = yield* Effect.promise(() =>
      new Agent(components.nina, {
        name: "test",
        languageModel: model,
        tools,
        stopWhen: isStepCount(3),
      }).generateText(ctx, { userId: turn.userId }, { prompt })
    );
    return {
      // Only plain data leaves an action, so an error is its message.
      errors: Arr.filterMap(generated.content, (part) =>
        part.type === "tool-error"
          ? Result.succeed(
              part.error instanceof Error
                ? part.error.message
                : encodeJsonText(part.error)
            )
          : Result.failVoid
      ),
      logged,
      result: Arr.map(generated.toolResults, ({ output }) => output),
    };
  }).pipe(
    chatStep,
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

/**
 * Plays a scripted model as a stream and returns every output that its tool
 * calls streamed, in order, each marked final or not. A tool that publishes
 * cards streams one output for each, and ends with the final one.
 */
export function streamTurn({
  model,
  prompt,
  registry,
  ...turn
}: {
  readonly model: MockLanguageModelV4;
  readonly prompt: string;
  readonly registry: Parameters<typeof createCapabilities>[0];
} & Parameters<typeof turnOf>[0]) {
  return Effect.gen(function* () {
    const tools = yield* createCapabilities(registry).pipe(
      Effect.provideService(CapabilityTurn, turnOf(turn))
    );
    const ctx = yield* ActionCtx;
    const streamed = yield* Effect.promise(() =>
      new Agent(components.nina, {
        name: "test",
        languageModel: model,
        tools,
        stopWhen: isStepCount(3),
      }).streamText(ctx, { userId: turn.userId }, { prompt })
    );
    const parts = yield* Stream.runCollect(
      Stream.fromAsyncIterable(
        streamed.fullStream,
        (cause) => new ScriptedStreamError({ cause })
      )
    ).pipe(Effect.orDie);
    return Arr.filterMap(parts, (part) =>
      part.type === "tool-result"
        ? Result.succeed({
            final: part.preliminary !== true,
            output: part.output,
          })
        : Result.failVoid
    );
  }).pipe(inNewChatStep);
}
