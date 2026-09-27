import { Agent, type UsageHandler } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { ActionCtx } from "@repo/backend/confect/_generated/services";
import { LearningCapabilityNameSchema } from "@repo/backend/confect/nina/capability/spec";
import {
  defaultModel,
  getFastModelProviderOptions,
} from "@repo/backend/confect/nina/config/model";
import { getGatewayModel } from "@repo/backend/confect/nina/config/provider";
import { gatewayProviderOptions } from "@repo/backend/confect/nina/config/routing";
import { backgroundGenerationTimeout } from "@repo/backend/confect/nina/config/timeouts";
import type { NinaToolSet } from "@repo/backend/confect/nina/step";
import {
  InvalidToolInputError,
  NoSuchToolError,
  Output,
  type ToolCallRepairFunction,
} from "ai";
import { Effect, Schema } from "effect";

class NinaRepairError extends Schema.TaggedError<NinaRepairError>()(
  "NinaRepairError",
  { phase: Schema.Literals(["schema", "generation"]) }
) {}

/** Repairs known tool inputs through Agent, with every provider call accounted for. */
export const repairToolCall = Effect.fn("nina.repair")(
  function* ({
    userId,
    error,
    inputSchema,
    messages,
    needsPageFetch,
    toolCall,
    tools,
    url,
    usageHandler,
  }: Omit<Parameters<ToolCallRepairFunction<NinaToolSet>>[0], "system"> & {
    userId: Docs["users"]["_id"];
    needsPageFetch: boolean;
    url: string;
    usageHandler: UsageHandler;
  }) {
    if (
      NoSuchToolError.isInstance(error) ||
      !Schema.is(LearningCapabilityNameSchema)(toolCall.toolName)
    ) {
      return null;
    }
    const hasPageResult = messages.some(
      (message) =>
        message.role === "tool" &&
        message.content.some(
          (part) => part.type === "tool-result" && part.toolName === "nakafa"
        )
    );
    if (
      needsPageFetch &&
      !hasPageResult &&
      toolCall.toolName === "nakafa" &&
      InvalidToolInputError.isInstance(error)
    ) {
      return {
        ...toolCall,
        input: JSON.stringify({
          request: url,
          objective: "Read the current Nakafa page.",
          deliverables: ["current page evidence"],
          requirements: ["Use the current page URL."],
        }),
      };
    }
    const schema = yield* Effect.tryPromise({
      try: () => inputSchema(toolCall),
      catch: () => new NinaRepairError({ phase: "schema" }),
    });
    const tool = tools[toolCall.toolName];
    const ctx = yield* ActionCtx;
    const agent = new Agent(components.nina, {
      name: "nina-repair",
      languageModel: yield* getGatewayModel(defaultModel),
      usageHandler,
    });
    const result = yield* Effect.tryPromise({
      try: (signal) =>
        agent
          .generateText(
            ctx,
            { userId },
            {
              abortSignal: signal,
              output: Output.object({ schema: tool.inputSchema }),
              prompt: [
                `Repair the arguments for ${toolCall.toolName}. Keep the original task and source constraints. Do not invent another task or change the tool.`,
                `Failed arguments: ${toolCall.input}`,
                `Accepted schema: ${JSON.stringify(schema)}`,
                `Validation error: ${error.message}`,
              ].join("\n\n"),
              providerOptions: {
                gateway: gatewayProviderOptions,
                google: getFastModelProviderOptions(defaultModel),
              },
              timeout: backgroundGenerationTimeout,
            },
            { storageOptions: { saveMessages: "none" } }
          )
          .then((generated) => generated.output),
      catch: () => new NinaRepairError({ phase: "generation" }),
    });
    return { ...toolCall, input: JSON.stringify(result) };
  },
  Effect.catchTag("NinaRepairError", (error) =>
    Effect.logWarning("Nina tool repair unavailable", {
      phase: error.phase,
    }).pipe(Effect.as(null))
  )
);
