import { provider } from "@repo/ai/config/app";
import { getModelProviderOptions } from "@repo/ai/config/model";
import { gatewayProviderOptions } from "@repo/ai/config/routing";
import { chatStreamTimeout } from "@repo/ai/config/timeouts";
import type {
  NinaPage,
  NinaRuntime,
  NinaUser,
} from "@repo/ai/nina/contract/turn";
import { createNinaSystemPrompt } from "@repo/ai/nina/prompt/system";
import {
  createNinaPrepareStep,
  type NinaToolSet,
} from "@repo/ai/nina/runtime/step";
import type { MyMetadata, MyUIMessage } from "@repo/ai/types/message";
import {
  type AgentStreamParameters,
  isStepCount,
  type LanguageModelUsage,
  type ModelMessage,
  smoothStream,
  ToolLoopAgent,
  type ToolLoopAgentSettings,
  toUIMessageStream,
  type UIMessageStreamWriter,
} from "ai";
import { Effect, Schema } from "effect";

const MAX_ORCHESTRATOR_STEPS = 20;

/** Raised when the internal ToolLoopAgent cannot produce a Nina turn. */
export class NinaAgentError extends Schema.TaggedError<NinaAgentError>()(
  "NinaAgentError",
  {
    message: Schema.String,
    source: Schema.String,
  }
) {}

/** AI SDK-derived model-message array accepted by Nina's ToolLoopAgent stream. */
export type NinaAgentMessages = Extract<
  AgentStreamParameters<never, NinaToolSet>,
  { readonly messages: ModelMessage[] }
>["messages"];

type NinaAgentToolSettings = Required<
  Pick<ToolLoopAgentSettings<never, NinaToolSet>, "tools">
> &
  Pick<
    ToolLoopAgentSettings<never, NinaToolSet>,
    "experimental_repairToolCall"
  >;

/** Emits Nina context metadata at AI SDK stream lifecycle markers. */
function readNinaMessageMetadata({
  page,
  part,
  readFinishMetadata,
  runtime,
}: {
  readonly page: NinaPage;
  readonly part: {
    readonly totalUsage?: LanguageModelUsage;
    readonly type: string;
  };
  readonly readFinishMetadata: (usage: LanguageModelUsage) => MyMetadata;
  readonly runtime: NinaRuntime;
}): MyMetadata | undefined {
  if (part.type === "start") {
    return {
      model: runtime.modelId,
      ninaContextSnapshot: page.nina.snapshot,
      ninaContextTransition: page.nina.transition,
    };
  }

  if (part.type !== "finish" || !part.totalUsage) {
    return;
  }

  return {
    ...readFinishMetadata(part.totalUsage),
    ninaContextSnapshot: page.nina.snapshot,
    ninaContextTransition: page.nina.transition,
  };
}

/** Streams one Nina ToolLoopAgent turn through the internal agent lifecycle. */
export const runNinaAgentTurn = Effect.fn("nina.agent.turn")(function* ({
  messages,
  page,
  runtime,
  settings,
  stream,
  user,
}: {
  readonly messages: NinaAgentMessages;
  readonly page: NinaPage;
  readonly runtime: NinaRuntime;
  readonly settings: NinaAgentToolSettings;
  readonly stream: {
    readonly formatError: (error: unknown) => string;
    readonly onError: (error: unknown, source: string) => void;
    readonly readFinishMetadata: (usage: LanguageModelUsage) => MyMetadata;
    readonly writer: UIMessageStreamWriter<MyUIMessage>;
  };
  readonly user: NinaUser;
}) {
  const instructions = createNinaSystemPrompt({ page, runtime, user });
  const agent = new ToolLoopAgent<never, NinaToolSet>({
    id: "nina",
    instructions,
    model: provider.languageModel(runtime.modelId),
    prepareStep: createNinaPrepareStep({
      needsPageFetch: page.needsFetch,
      instructions,
    }),
    experimental_repairToolCall: settings.experimental_repairToolCall,
    providerOptions: {
      gateway: gatewayProviderOptions,
      google: getModelProviderOptions(runtime.modelId),
    },
    stopWhen: isStepCount(MAX_ORCHESTRATOR_STEPS),
    tools: settings.tools,
  });
  const streamTextResult = yield* Effect.tryPromise({
    try: () =>
      agent.stream({
        experimental_transform: smoothStream({
          chunking: "word",
          delayInMs: 20,
        }),
        messages,
        timeout: chatStreamTimeout,
      }),
    catch: () =>
      new NinaAgentError({
        message: "Nina ToolLoopAgent failed to start streaming.",
        source: "agent.stream",
      }),
  });

  stream.writer.merge(
    toUIMessageStream({
      messageMetadata: ({ part }) =>
        readNinaMessageMetadata({
          page,
          part,
          readFinishMetadata: stream.readFinishMetadata,
          runtime,
        }),
      onError: (error) => {
        stream.onError(error, "toUIMessageStream");
        return stream.formatError(error);
      },
      sendReasoning: true,
      sendStart: false,
      stream: streamTextResult.stream,
    })
  );

  const response = yield* Effect.tryPromise({
    try: () => streamTextResult.response,
    catch: () =>
      new NinaAgentError({
        message: "Nina ToolLoopAgent response metadata was unavailable.",
        source: "agent.response",
      }),
  });

  return response.messages;
});
