import { createNinaCapabilityCatalog } from "@repo/ai/nina/capability/catalog";
import {
  createNinaAgentContext,
  type NinaTurn,
} from "@repo/ai/nina/contract/turn";
import type { NinaAgentMessages } from "@repo/ai/nina/runtime/agent";
import { runNinaAgentTurn } from "@repo/ai/nina/runtime/agent";
import { formatNinaStreamError } from "@repo/ai/nina/runtime/error";
import { createPageFetchState } from "@repo/ai/nina/runtime/page";
import { repairNinaToolCall } from "@repo/ai/nina/runtime/repair";
import { NinaReporter } from "@repo/ai/nina/runtime/report";
import { writeNinaSuggestions } from "@repo/ai/nina/runtime/suggest";
import { trackUsage } from "@repo/ai/nina/runtime/usage";
import { NinaWorkspaceRuntime } from "@repo/ai/nina/workspace/runtime";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { LogContext } from "@repo/utilities/logging/types";
import type { UIMessageStreamWriter } from "ai";
import { type Context, Effect } from "effect";

/**
 * Streams one Nina ToolLoopAgent turn into the AI SDK UI writer.
 * The caller owns the request-scoped workspace so final persistence can read
 * the same artifacts that capability tools appended during execution.
 */
export const runNinaWriterTurn = Effect.fn("nina.stream.writer")(function* ({
  finalMessages,
  logContext,
  onStreamError,
  copy,
  page,
  responseMessageIdentifier,
  runtime,
  user,
  writer,
  workspace,
}: {
  readonly copy: NinaTurn["copy"];
  readonly finalMessages: NinaAgentMessages;
  readonly logContext: LogContext;
  readonly onStreamError: (error: unknown, source: string) => void;
  readonly page: NinaTurn["page"];
  readonly responseMessageIdentifier: string;
  readonly runtime: NinaTurn["runtime"];
  readonly user: NinaTurn["user"];
  readonly writer: UIMessageStreamWriter<MyUIMessage>;
  readonly workspace: Context.Tag.Service<typeof NinaWorkspaceRuntime>;
}) {
  const usage = yield* trackUsage();
  const context = createNinaAgentContext({ page, runtime, user });
  const pageFetch = createPageFetchState(context.needsPageFetch);
  const reporter = yield* NinaReporter;
  const tools = yield* createNinaCapabilityCatalog({
    context,
    locale: page.nina.learning.locale,
    logContext,
    modelId: runtime.modelId,
    responseMessageIdentifier,
    consumePageFetch: pageFetch.consumeForTool,
    usage,
    writer,
  }).pipe(Effect.provideService(NinaWorkspaceRuntime, workspace));

  const responseMessages = yield* runNinaAgentTurn({
    messages: finalMessages,
    page,
    readWorkspaceProjection: () => Effect.runSync(workspace.readProjection()),
    runtime,
    settings: {
      experimental_repairToolCall: (options) =>
        Effect.runPromise(
          repairNinaToolCall({
            ...options,
            reporter,
            reservePageFetch: pageFetch.reserveForRepair,
            sessionLogger: logContext,
            url: context.url,
          })
        ),
      tools,
    },
    stream: {
      formatError: (error) =>
        formatNinaStreamError({
          error,
          logContext,
          turn: { page, runtime, user, copy },
        }),
      onError: onStreamError,
      readFinishMetadata: (mainUsage) =>
        Effect.runSync(
          usage.metadata({
            mainUsage,
            modelId: runtime.modelId,
          })
        ),
      writer,
    },
    user,
  });

  yield* writeNinaSuggestions({
    locale: page.locale,
    messages: [...finalMessages, ...responseMessages],
    writer,
  }).pipe(
    Effect.catchAll((error) =>
      reporter.report({ error, source: "writeNinaSuggestions" })
    )
  );
});
