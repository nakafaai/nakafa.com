import { TOOL_NAMES } from "@repo/ai/agents/orchestrator/names";
import { defaultModel } from "@repo/ai/config/models";
import { type GoogleProvider, model, order } from "@repo/ai/config/vercel";
import { type createChildLogger, logError } from "@repo/utilities/logging";
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
  sessionLogger: ReturnType<typeof createChildLogger>;
  url: string;
}

/**
 * Repairs invalid chat tool calls with deterministic page-fetch input when needed.
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
    yield* Effect.sync(() =>
      logError(sessionLogger, error, {
        errorLocation: "experimental_repairToolCall",
        toolName: toolCall.toolName,
        toolInput: toolCall.input,
        errorType: error.name,
      })
    );

    if (NoSuchToolError.isInstance(error)) {
      yield* Effect.sync(() =>
        sessionLogger.warn("Invalid tool name, not attempting repair")
      );
      return null;
    }

    if (
      needsPageFetch &&
      toolCall.toolName === TOOL_NAMES.contentAccess &&
      InvalidToolInputError.isInstance(error)
    ) {
      yield* Effect.sync(() =>
        sessionLogger.info("Using server-derived content access input")
      );
      return {
        ...toolCall,
        input: JSON.stringify({ query: url }, null, 2),
      };
    }

    const tool = tools[toolCall.toolName];
    if (!tool) {
      yield* Effect.sync(() =>
        sessionLogger.warn("Tool is unavailable, not attempting repair")
      );
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
          gateway: { order },
          google: {
            thinkingConfig: {
              thinkingBudget: 0,
              includeThoughts: false,
            },
          } satisfies GoogleProvider,
        },
      })
    );

    yield* Effect.sync(() =>
      sessionLogger.info("Tool call successfully repaired")
    );
    return {
      ...toolCall,
      input: JSON.stringify(repairedArgs, null, 2),
    };
  }
);
