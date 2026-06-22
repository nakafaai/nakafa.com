import { nakafaPrompt } from "@repo/ai/agents/orchestrator/prompt";
import { provider } from "@repo/ai/config/app";
import { getModelProviderOptions, type ModelId } from "@repo/ai/config/model";
import { gatewayProviderOptions } from "@repo/ai/config/routing";
import { chatStreamTimeout } from "@repo/ai/config/timeouts";
import type { NinaContextPack } from "@repo/ai/nina/context";
import type { AgentContext, AgentLearningProfile } from "@repo/ai/types/agents";
import type { MyMetadata, MyUIMessage } from "@repo/ai/types/message";
import type { PromptUserRole } from "@repo/ai/types/roles";
import { cleanSlug } from "@repo/utilities/helper";
import type { Locale } from "@repo/utilities/locales";
import {
  type LanguageModelUsage,
  type ModelMessage,
  type PrepareStepFunction,
  smoothStream,
  stepCountIs,
  type ToolCallRepairFunction,
  ToolLoopAgent,
  type ToolSet,
  type UIMessageStreamWriter,
} from "ai";
import { Effect } from "effect";

const MAX_ORCHESTRATOR_STEPS = 20;

/** Prepared chat state consumed by Nina's ToolLoopAgent lifecycle. */
export interface NinaAgentChat {
  readonly finalMessages: ModelMessage[];
}

/** Verified page state consumed by Nina's ToolLoopAgent lifecycle. */
export interface NinaAgentPage {
  readonly locale: Locale;
  readonly needsFetch: boolean;
  readonly nina: NinaContextPack;
  readonly slug: string;
  readonly url: string;
  readonly verified: boolean;
}

/** Runtime model and date facts consumed by Nina's ToolLoopAgent lifecycle. */
export interface NinaAgentRuntime {
  readonly currentDate: string;
  readonly modelId: ModelId;
}

/** User facts Nina may use after page and profile context are validated. */
export interface NinaAgentUser {
  readonly learningProfile?: AgentLearningProfile;
  readonly location: {
    readonly city: string;
    readonly country: string;
    readonly countryRegion: string;
    readonly latitude: string;
    readonly longitude: string;
  };
  readonly role?: PromptUserRole;
}

/** Callback surface supplied by the app Adapter around AI SDK execution. */
export interface NinaAgentAdapter<TOOLS extends ToolSet> {
  readonly formatStreamError: (error: unknown) => string;
  readonly onStreamError: (error: unknown, source: string) => void;
  readonly prepareStep: (input: {
    readonly messages: ModelMessage[];
    readonly stepNumber: number;
    readonly system: string;
  }) => ReturnType<PrepareStepFunction<TOOLS>>;
  readonly readFinishMetadata: (usage: LanguageModelUsage) => MyMetadata;
  readonly repairToolCall: ToolCallRepairFunction<TOOLS>;
  readonly tools: TOOLS;
  readonly writer: UIMessageStreamWriter<MyUIMessage>;
}

/** Result returned after Nina's ToolLoopAgent stream has produced response messages. */
export interface NinaAgentTurn {
  readonly messages: ModelMessage[];
}

/** Builds the shared specialist context from validated Nina session inputs. */
export function createNinaAgentContext({
  page,
  runtime,
  user,
}: {
  readonly page: NinaAgentPage;
  readonly runtime: NinaAgentRuntime;
  readonly user: NinaAgentUser;
}): AgentContext {
  return {
    currentDate: runtime.currentDate,
    learningProfile: user.learningProfile,
    needsPageFetch: page.needsFetch,
    nina: page.nina,
    slug: cleanSlug(page.slug),
    url: page.url,
    userRole: user.role,
    verified: page.verified,
  };
}

/** Builds Nina's system prompt from validated runtime, page, and user context. */
function createNinaSystemPrompt({
  page,
  runtime,
  user,
}: {
  readonly page: NinaAgentPage;
  readonly runtime: NinaAgentRuntime;
  readonly user: NinaAgentUser;
}) {
  return nakafaPrompt({
    currentDate: runtime.currentDate,
    currentPage: {
      locale: page.locale,
      slug: page.slug,
      verified: page.verified,
    },
    learningProfile: user.learningProfile,
    nina: page.nina,
    url: page.url,
    userLocation: user.location,
    userRole: user.role,
  });
}

/** Emits Nina context metadata at AI SDK stream lifecycle markers. */
function readNinaMessageMetadata({
  page,
  part,
  readFinishMetadata,
  runtime,
}: {
  readonly page: NinaAgentPage;
  readonly part: {
    readonly totalUsage?: LanguageModelUsage;
    readonly type: string;
  };
  readonly readFinishMetadata: NinaAgentAdapter<ToolSet>["readFinishMetadata"];
  readonly runtime: NinaAgentRuntime;
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

/** Streams one Nina ToolLoopAgent turn through the package-owned agent lifecycle. */
export const runNinaAgentTurn = Effect.fn("nina.runNinaAgentTurn")(function* <
  TOOLS extends ToolSet,
>({
  adapter,
  chat,
  page,
  runtime,
  user,
}: {
  readonly adapter: NinaAgentAdapter<TOOLS>;
  readonly chat: NinaAgentChat;
  readonly page: NinaAgentPage;
  readonly runtime: NinaAgentRuntime;
  readonly user: NinaAgentUser;
}) {
  const system = createNinaSystemPrompt({ page, runtime, user });
  const agent = new ToolLoopAgent({
    id: "nina",
    instructions: system,
    model: provider.languageModel(runtime.modelId),
    prepareStep: ({ messages, stepNumber }) =>
      adapter.prepareStep({ messages, stepNumber, system }),
    experimental_repairToolCall: adapter.repairToolCall,
    providerOptions: {
      gateway: gatewayProviderOptions,
      google: getModelProviderOptions(runtime.modelId),
    },
    stopWhen: stepCountIs(MAX_ORCHESTRATOR_STEPS),
    tools: adapter.tools,
  });
  const streamTextResult = yield* Effect.tryPromise({
    try: () =>
      agent.stream({
        experimental_transform: smoothStream({
          chunking: "word",
          delayInMs: 20,
        }),
        messages: chat.finalMessages,
        timeout: chatStreamTimeout,
      }),
    catch: (error) => error,
  });

  adapter.writer.merge(
    streamTextResult.toUIMessageStream({
      messageMetadata: ({ part }) =>
        readNinaMessageMetadata({
          page,
          part,
          readFinishMetadata: adapter.readFinishMetadata,
          runtime,
        }),
      onError: (error) => {
        adapter.onStreamError(error, "toUIMessageStream");
        return adapter.formatStreamError(error);
      },
      sendReasoning: true,
      sendStart: false,
    })
  );

  const response = yield* Effect.tryPromise({
    try: () => streamTextResult.response,
    catch: (error) => error,
  });

  return {
    messages: response.messages,
  };
});
