import { TOOL_NAMES } from "@repo/ai/agents/orchestrator/names";
import { gatewayProviderOptions } from "@repo/ai/config/gateway-options";
import {
  defaultModel,
  getFastModelProviderOptions,
} from "@repo/ai/config/models";
import { backgroundGenerationTimeout } from "@repo/ai/config/timeouts";
import { model } from "@repo/ai/config/vercel";
import { logError } from "@repo/utilities/logging/effect";
import type { LogContext } from "@repo/utilities/logging/types";
import {
  generateText,
  InvalidToolInputError,
  NoSuchToolError,
  Output,
  type ToolCallRepairFunction,
  type ToolSet,
} from "ai";
import { Effect } from "effect";

type ChatRepairOptions = Parameters<ToolCallRepairFunction<ToolSet>>[0];

interface Params extends ChatRepairOptions {
  needsPageFetch: boolean;
  sessionLogger: LogContext;
  url: string;
}

/**
 * Repairs invalid chat tool calls with deterministic page-fetch input when needed.
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#tool-call-repair
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-core/output#output-object
 */
export const repairChatToolCall = Effect.fn("chat.repairChatToolCall")(
  function* ({
    error,
    inputSchema,
    needsPageFetch,
    sessionLogger,
    toolCall,
    tools,
    url,
  }: Params) {
    yield* logError(error, {
      ...sessionLogger,
      errorLocation: "experimental_repairToolCall",
      toolName: toolCall.toolName,
      toolInput: toolCall.input,
      errorType: error.name,
    });

    if (NoSuchToolError.isInstance(error)) {
      yield* Effect.logWarning("Invalid tool name, not attempting repair").pipe(
        Effect.annotateLogs(sessionLogger)
      );
      return null;
    }

    if (
      needsPageFetch &&
      toolCall.toolName === TOOL_NAMES.nakafa &&
      InvalidToolInputError.isInstance(error)
    ) {
      yield* Effect.logInfo("Using server-derived Nakafa input").pipe(
        Effect.annotateLogs(sessionLogger)
      );
      return {
        ...toolCall,
        input: JSON.stringify(
          {
            deliverables: ["current page evidence"],
            objective: "Read the current Nakafa page.",
            request: url,
            requirements: ["Use the current page URL."],
          },
          null,
          2
        ),
      };
    }

    const tool = tools[toolCall.toolName];
    if (!tool) {
      yield* Effect.logWarning(
        "Tool is unavailable, not attempting repair"
      ).pipe(Effect.annotateLogs(sessionLogger));
      return null;
    }

    const schema = yield* Effect.tryPromise(() => inputSchema(toolCall));
    const { output: repairedArgs } = yield* Effect.tryPromise(() =>
      generateText({
        model: model.languageModel(defaultModel),
        output: Output.object({ schema: tool.inputSchema }),
        prompt: [
          `The model tried to call the tool "${toolCall.toolName}"` +
            " with the following arguments:",
          JSON.stringify(toolCall.input, null, 2),
          "The tool accepts the following schema:",
          JSON.stringify(schema, null, 2),
          "Please fix the arguments.",
        ].join("\n"),
        providerOptions: {
          gateway: gatewayProviderOptions,
          google: getFastModelProviderOptions(defaultModel),
        },
        timeout: backgroundGenerationTimeout,
      })
    );

    yield* Effect.logInfo("Tool call successfully repaired").pipe(
      Effect.annotateLogs(sessionLogger)
    );
    return {
      ...toolCall,
      input: JSON.stringify(repairedArgs, null, 2),
    };
  }
);
