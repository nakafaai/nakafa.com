import { gatewayProviderOptions } from "@repo/ai/config/gateway-options";
import { getModelProviderOptions, type ModelId } from "@repo/ai/config/models";
import { model } from "@repo/ai/config/vercel";
import {
  generateText,
  NoSuchToolError,
  Output,
  type ToolCallRepairFunction,
  type ToolSet,
} from "ai";
import { Effect, Schema } from "effect";

type MathRepairOptions = Parameters<ToolCallRepairFunction<ToolSet>>[0];

interface RepairMathToolCallParams extends MathRepairOptions {
  modelId: ModelId;
  task: string;
}

const repairArgumentsSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
});

const operationSchema = Schema.Struct({
  operation: Schema.String,
});

/** Reads the requested operation from raw tool arguments. */
function decodeOperation(input: string) {
  return Schema.decodeUnknown(Schema.parseJson(operationSchema))(input);
}

/**
 * Repairs invalid math tool inputs while preserving the selected tool.
 *
 * The repair prompt copies expressions from the original user request so
 * incomplete tool arguments do not reach the deterministic math service.
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#tool-call-repair
 */
export const repairMathToolCall = Effect.fn("math.repairToolCall")(function* ({
  error,
  inputSchema,
  modelId,
  system,
  task,
  toolCall,
  tools,
}: RepairMathToolCallParams) {
  if (NoSuchToolError.isInstance(error)) {
    return null;
  }

  const tool = tools[toolCall.toolName];

  if (!tool) {
    return null;
  }

  const schema = yield* Effect.tryPromise(() => inputSchema(toolCall)).pipe(
    Effect.either
  );

  if (schema._tag === "Left") {
    return null;
  }

  const repaired = yield* Effect.tryPromise(() =>
    generateText({
      model: model.languageModel(modelId),
      output: Output.object({ schema: tool.inputSchema }),
      prompt: [
        "Repair the math tool arguments without changing the selected tool.",
        "Keep the operation field exactly the same as the failed arguments.",
        "Copy the exact expression, equation, points, matrix, or dataset from the original user request.",
        "Do not invent a new math problem.",
        "For equivalence or validity checks, use compare with left and right expressions.",
        "For simplify, factor, expand, cancel, together, apart, rationalize, or domain, include expression.",
        "For derivative, integral, or limit, include expression and use variable x unless the request names another variable.",
        `Selected tool: ${toolCall.toolName}`,
        "Original user request:",
        task,
        "Failed arguments:",
        JSON.stringify(toolCall.input, null, 2),
        "Accepted schema:",
        JSON.stringify(schema.right, null, 2),
        "Validation error:",
        error.message,
      ].join("\n"),
      providerOptions: {
        gateway: gatewayProviderOptions,
        google: getModelProviderOptions(modelId),
      },
      system,
    })
  ).pipe(Effect.either);

  if (repaired._tag === "Left") {
    return null;
  }

  const repairedInput = yield* Effect.either(
    Schema.decodeUnknown(repairArgumentsSchema)(repaired.right.output)
  );

  if (repairedInput._tag === "Left") {
    return null;
  }

  const originalOperation = yield* Effect.either(
    decodeOperation(toolCall.input)
  );
  const input =
    originalOperation._tag === "Right"
      ? { ...repairedInput.right, operation: originalOperation.right.operation }
      : repairedInput.right;

  return {
    ...toolCall,
    input: JSON.stringify(input, null, 2),
  };
});
