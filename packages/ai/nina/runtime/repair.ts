import { provider } from "@repo/ai/config/app";
import {
  defaultModel,
  getFastModelProviderOptions,
} from "@repo/ai/config/model";
import { gatewayProviderOptions } from "@repo/ai/config/routing";
import { backgroundGenerationTimeout } from "@repo/ai/config/timeouts";
import { NAKAFA_CAPABILITY } from "@repo/ai/nina/capability/spec";
import type { NinaReporter } from "@repo/ai/nina/runtime/report";
import type { NinaToolSet } from "@repo/ai/nina/runtime/step";
import { logError } from "@repo/utilities/logging/effect";
import type { LogContext } from "@repo/utilities/logging/types";
import {
  generateText,
  InvalidToolInputError,
  NoSuchToolError,
  Output,
  type ToolCallRepairFunction,
} from "ai";
import { type Context, Effect } from "effect";

type NinaRepairOptions = Parameters<ToolCallRepairFunction<NinaToolSet>>[0] & {
  readonly reporter: Context.Tag.Service<typeof NinaReporter>;
  readonly reservePageFetch: () => boolean;
  readonly sessionLogger: LogContext;
  readonly url: string;
};

/**
 * Recovers invalid Nina tool calls without permitting repeated page fetches.
 *
 * The input shape derives from AI SDK's `ToolCallRepairFunction`; this Module
 * only adds the request-scoped page-fetch reservation and diagnostics service.
 */
export const repairNinaToolCall = Effect.fn("nina.repair.toolCall")(function* ({
  error,
  inputSchema,
  reporter,
  reservePageFetch,
  sessionLogger,
  toolCall,
  tools,
  url,
}: NinaRepairOptions) {
  yield* logError(error, {
    ...sessionLogger,
    errorLocation: "repairToolCall",
    toolName: toolCall.toolName,
    toolInput: toolCall.input,
    errorType: error.name,
  });

  if (NoSuchToolError.isInstance(error)) {
    yield* Effect.logWarning("Invalid tool name, not attempting recovery").pipe(
      Effect.annotateLogs(sessionLogger)
    );
    return null;
  }

  if (
    toolCall.toolName === NAKAFA_CAPABILITY &&
    InvalidToolInputError.isInstance(error) &&
    reservePageFetch()
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
      "Tool is unavailable, not attempting recovery"
    ).pipe(Effect.annotateLogs(sessionLogger));
    return null;
  }

  const schema = yield* Effect.tryPromise({
    try: () => inputSchema(toolCall),
    catch: (cause) => cause,
  }).pipe(
    Effect.tapError((cause) =>
      reporter.report({ error: cause, source: "repair.inputSchema" })
    )
  );
  const { output: recoveredArgs } = yield* Effect.tryPromise({
    try: () =>
      generateText({
        model: provider.languageModel(defaultModel),
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
      }),
    catch: (cause) => cause,
  });

  yield* Effect.logInfo("Tool call successfully recovered").pipe(
    Effect.annotateLogs(sessionLogger)
  );
  return {
    ...toolCall,
    input: JSON.stringify(recoveredArgs, null, 2),
  };
});
