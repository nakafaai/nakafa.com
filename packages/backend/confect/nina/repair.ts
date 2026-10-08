import { Agent, type UsageHandler } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { ActionCtx } from "@repo/backend/confect/_generated/services";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import { defaultModel } from "@repo/backend/confect/gateway/model";
import { LearningCapabilityNameSchema } from "@repo/backend/confect/nina/capability/spec";
import type { NinaToolSet } from "@repo/backend/confect/nina/step";
import { NoSuchToolError, Output, type ToolCallRepairFunction } from "ai";
import { Array as Arr, Effect, Schema } from "effect";

const jsonTextSchema = Schema.fromJsonString(Schema.Unknown);

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
    toolCall,
    tools,
    usageHandler,
  }: Omit<
    Parameters<ToolCallRepairFunction<NinaToolSet>>[0],
    "messages" | "system"
  > & {
    userId: Docs["users"]["_id"];
    usageHandler: UsageHandler;
  }) {
    if (
      NoSuchToolError.isInstance(error) ||
      !Schema.is(LearningCapabilityNameSchema)(toolCall.toolName)
    ) {
      return null;
    }
    const schema = yield* Effect.tryPromise({
      try: () => inputSchema(toolCall),
      catch: () => new NinaRepairError({ phase: "schema" }),
    });
    const tool = tools[toolCall.toolName];
    const ctx = yield* ActionCtx;
    const handle = (yield* Gateway).language({
      purpose: "background",
      model: defaultModel,
    });
    const agent = new Agent(components.nina, {
      name: "nina-repair",
      languageModel: handle.model,
      usageHandler,
    });
    const acceptedSchema = yield* Schema.encodeEffect(jsonTextSchema)(
      schema
    ).pipe(Effect.orDie);
    const result = yield* Effect.tryPromise({
      try: (signal) =>
        agent
          .generateText(
            ctx,
            { userId },
            {
              abortSignal: signal,
              output: Output.object({ schema: tool.inputSchema }),
              prompt: Arr.join(
                [
                  `Repair the arguments for ${toolCall.toolName}. Keep the original task and source constraints. Do not invent another task or change the tool.`,
                  `Failed arguments: ${toolCall.input}`,
                  `Accepted schema: ${acceptedSchema}`,
                  `Validation error: ${error.message}`,
                ],
                "\n\n"
              ),
              timeout: handle.timeout,
            },
            { storageOptions: { saveMessages: "none" } }
          )
          .then((generated) => generated.output),
      catch: () => new NinaRepairError({ phase: "generation" }),
    });
    const input = yield* Schema.encodeEffect(jsonTextSchema)(result).pipe(
      Effect.orDie
    );
    return { ...toolCall, input };
  },
  Effect.catchTag("NinaRepairError", (error) =>
    Effect.logWarning("Nina tool repair unavailable", {
      phase: error.phase,
    }).pipe(Effect.as(null))
  )
);
