import {
  type NinaAgentChat as CoreNinaAgentChat,
  type NinaAgentRuntime as CoreNinaAgentRuntime,
  type NinaAgentUser as CoreNinaAgentUser,
  createNinaAgentContext,
  type NinaAgentPage,
  runNinaAgentTurn,
} from "@repo/ai/nina/agent";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { LogContext } from "@repo/utilities/logging/types";
import type { UIMessageStreamWriter } from "ai";
import { Effect } from "effect";
import type { getTranslations } from "next-intl/server";
import { recoverChatToolCall } from "@/app/api/chat/recovery";
import { prepareChatStep } from "@/app/api/chat/step";
import { writeSuggestions } from "@/app/api/chat/suggestions";
import { createNinaToolSet } from "@/app/api/chat/tools";
import { trackUsage } from "@/app/api/chat/usage";
import type { getLearningProfile, getUserInfo } from "@/app/api/chat/utils";

type Translator = Awaited<ReturnType<typeof getTranslations>>;
type LearningProfile = Effect.Effect.Success<
  ReturnType<typeof getLearningProfile>
>;
type UserInfo = Effect.Effect.Success<ReturnType<typeof getUserInfo>>;

/** Prepared chat state needed by Nina's ToolLoopAgent turn. */
export interface NinaAgentChat extends CoreNinaAgentChat {
  readonly id: Id<"chats">;
}

/** Runtime services and callbacks for Nina's ToolLoopAgent turn. */
export interface NinaAgentRuntime extends CoreNinaAgentRuntime {
  readonly logContext: LogContext;
  readonly reportError: (error: unknown, source: string) => void;
  readonly translate: Translator;
}

/** User context exposed to Nina's ToolLoopAgent turn. */
export interface NinaAgentUser
  extends Omit<CoreNinaAgentUser, "learningProfile" | "role"> {
  readonly info: UserInfo;
  readonly learningProfile: LearningProfile;
}

/** Inputs for the app-bound Nina ToolLoopAgent execution seam. */
export interface StreamNinaAgentInput {
  readonly chat: NinaAgentChat;
  readonly onStreamError: (error: unknown, source: string) => void;
  readonly page: NinaAgentPage;
  readonly runtime: NinaAgentRuntime;
  readonly user: NinaAgentUser;
  readonly writer: UIMessageStreamWriter<MyUIMessage>;
}

/** Converts app auth/profile rows into the package-owned Nina user context. */
function createCoreNinaUser(user: NinaAgentUser): CoreNinaAgentUser {
  return {
    learningProfile: user.learningProfile ?? undefined,
    location: user.location,
    role: user.info.role ?? undefined,
  };
}

/** Formats AI SDK stream errors while preserving server-side diagnostics. */
function formatNinaStreamError({
  error,
  runtime,
}: {
  readonly error: unknown;
  readonly runtime: NinaAgentRuntime;
}) {
  if (error instanceof Error) {
    if (error.message.includes("Rate limit")) {
      Effect.runFork(
        Effect.logWarning("Rate limit exceeded in message stream").pipe(
          Effect.annotateLogs(runtime.logContext)
        )
      );
      return runtime.translate("rate-limit-message");
    }

    return error.message;
  }

  Effect.runFork(
    Effect.logError("Unknown error in message stream").pipe(
      Effect.annotateLogs(runtime.logContext)
    )
  );
  return runtime.translate("error-message");
}

/** Streams one Nina ToolLoopAgent turn into the AI SDK UI writer. */
export const streamNinaAgent = Effect.fn("chat.streamNinaAgent")(function* ({
  chat,
  onStreamError,
  page,
  runtime,
  user,
  writer,
}: StreamNinaAgentInput) {
  const usage = yield* trackUsage();
  const coreUser = createCoreNinaUser(user);
  const context = createNinaAgentContext({
    page,
    runtime,
    user: coreUser,
  });

  const turn = yield* runNinaAgentTurn({
    adapter: {
      formatStreamError: (error) => formatNinaStreamError({ error, runtime }),
      onStreamError,
      prepareStep: ({ messages, stepNumber, system }) =>
        Effect.runSync(
          prepareChatStep({
            messages,
            needsPageFetch: page.needsFetch,
            stepNumber,
            system,
          })
        ),
      readFinishMetadata: (mainUsage) =>
        Effect.runSync(
          usage.metadata({
            mainUsage,
            modelId: runtime.modelId,
          })
        ),
      repairToolCall: (options) =>
        Effect.runPromise(
          recoverChatToolCall({
            ...options,
            needsPageFetch: context.needsPageFetch,
            sessionLogger: runtime.logContext,
            url: page.url,
          })
        ),
      tools: createNinaToolSet({
        context,
        locale: page.locale,
        logContext: runtime.logContext,
        modelId: runtime.modelId,
        reportError: runtime.reportError,
        usage,
        writer,
      }),
      writer,
    },
    chat,
    page,
    runtime,
    user: coreUser,
  });

  yield* writeSuggestions({
    locale: page.locale,
    messages: [...chat.finalMessages, ...turn.messages],
    writer,
  }).pipe(
    Effect.catchAll((error) =>
      Effect.sync(() => runtime.reportError(error, "writeSuggestions"))
    )
  );
});
