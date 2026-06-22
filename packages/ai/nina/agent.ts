import { nakafaPrompt } from "@repo/ai/agents/orchestrator/prompt";
import { provider } from "@repo/ai/config/app";
import { getModelProviderOptions, ModelIdSchema } from "@repo/ai/config/model";
import { gatewayProviderOptions } from "@repo/ai/config/routing";
import { chatStreamTimeout } from "@repo/ai/config/timeouts";
import { NinaContextPackSchema } from "@repo/ai/nina/context";
import {
  type AgentContext,
  AgentLearningProfileSchema,
} from "@repo/ai/types/agents";
import type { MyMetadata, MyUIMessage } from "@repo/ai/types/message";
import { PromptUserRoleSchema } from "@repo/ai/types/roles";
import { LocaleSchema } from "@repo/contents/_types/content";
import { cleanSlug } from "@repo/utilities/helper";
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
import { Effect, Schema } from "effect";

const MAX_ORCHESTRATOR_STEPS = 20;

/** Prepared chat state consumed by Nina's ToolLoopAgent lifecycle. */
export interface NinaAgentChat {
  readonly finalMessages: ModelMessage[];
}

/** Verified page state consumed by Nina's ToolLoopAgent lifecycle. */
export const NinaAgentPageSchema = Schema.Struct({
  locale: LocaleSchema,
  needsFetch: Schema.Boolean,
  nina: NinaContextPackSchema,
  slug: Schema.String,
  url: Schema.String,
  verified: Schema.Boolean,
}).pipe(Schema.mutable);

export type NinaAgentPage = Schema.Schema.Type<typeof NinaAgentPageSchema>;

/** Runtime model and date facts consumed by Nina's ToolLoopAgent lifecycle. */
export const NinaAgentRuntimeSchema = Schema.Struct({
  currentDate: Schema.String,
  modelId: ModelIdSchema,
}).pipe(Schema.mutable);

export type NinaAgentRuntime = Schema.Schema.Type<
  typeof NinaAgentRuntimeSchema
>;

/** Coarse user-location facts allowed in Nina prompt context. */
export const NinaAgentUserLocationSchema = Schema.Struct({
  city: Schema.String,
  country: Schema.String,
  countryRegion: Schema.String,
  latitude: Schema.String,
  longitude: Schema.String,
}).pipe(Schema.mutable);

/** User facts Nina may use after page and profile context are validated. */
export const NinaAgentUserSchema = Schema.Struct({
  learningProfile: Schema.optional(AgentLearningProfileSchema),
  location: NinaAgentUserLocationSchema,
  role: Schema.optional(PromptUserRoleSchema),
}).pipe(Schema.mutable);

export type NinaAgentUser = Schema.Schema.Type<typeof NinaAgentUserSchema>;

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
    needsPageFetch: page.needsFetch,
    nina: page.nina,
    slug: cleanSlug(page.slug),
    url: page.url,
    verified: page.verified,
    ...(user.learningProfile ? { learningProfile: user.learningProfile } : {}),
    ...(user.role ? { userRole: user.role } : {}),
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
