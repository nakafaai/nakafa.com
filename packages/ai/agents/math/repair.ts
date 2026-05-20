import { gatewayProviderOptions } from "@repo/ai/config/gateway-options";
import {
  getFastModelProviderOptions,
  type ModelId,
} from "@repo/ai/config/models";
import { backgroundGenerationTimeout } from "@repo/ai/config/timeouts";
import { model } from "@repo/ai/config/vercel";
import { createPrompt } from "@repo/ai/prompt/utils";
import {
  generateText,
  NoSuchToolError,
  Output,
  type ToolCallRepairFunction,
  type ToolSet,
} from "ai";
import { Effect, Option, Schema } from "effect";

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
    Effect.option
  );

  if (Option.isNone(schema)) {
    return null;
  }

  const failedArguments = yield* Schema.decodeUnknown(
    Schema.parseJson(Schema.Unknown)
  )(toolCall.input).pipe(Effect.option);
  const failedArgumentsText = Option.match(failedArguments, {
    onNone: () => toolCall.input,
    onSome: (input) => JSON.stringify(input, null, 2),
  });

  const repaired = yield* Effect.tryPromise(() =>
    generateText({
      model: model.languageModel(modelId),
      output: Output.object({ schema: tool.inputSchema }),
      prompt: createPrompt({
        taskContext: `
        # Repair Task

        Repair the math tool arguments without changing the selected tool.
      `,

        toolUsageGuidelines: `
        # Repair Rules

        - Keep the operation field exactly the same as the failed arguments.
        - Start from the failed arguments and keep every relevant existing field that the accepted schema allows.
        - Add or correct only the fields needed to satisfy validation.
        - Do not drop bounds, inclusivity flags, variables, matrices, points, datasets, or expression data from the failed arguments.
        - Copy the exact expression, equation, points, matrix, or dataset from the original user request.
        - Do not invent a new math problem.
        - For equivalence or validity checks, use compare with left and right expressions.
        - For simplify, factor, expand, cancel, together, apart, rationalize, or domain, include expression.
        - For derivative, integral, or limit, include expression.
        - Use variable x unless the request names another variable.
        - For a definite or improper integral, include lower and upper exactly from the original request.
        - For equation systems with lower or upper solve-domain bounds, include variable for the bounded variable and variables for all solved variables.
        - For named probability distributions, include distribution and parameters.
        - Include the requested probability point or event bounds.
      `,

        backgroundData: `
        # Selected Tool

        ${toolCall.toolName}

        # Original User Request

        ${task}

        # Failed Arguments

        ${failedArgumentsText}

        # Accepted Schema

        ${JSON.stringify(schema.value, null, 2)}

        # Validation Error

        ${error.message}
      `,
      }),
      providerOptions: {
        gateway: gatewayProviderOptions,
        google: getFastModelProviderOptions(modelId),
      },
      system,
      timeout: backgroundGenerationTimeout,
    })
  ).pipe(Effect.option);

  if (Option.isNone(repaired)) {
    return null;
  }

  const repairedInput = yield* Schema.decodeUnknown(repairArgumentsSchema)(
    repaired.value.output
  ).pipe(Effect.option);

  if (Option.isNone(repairedInput)) {
    return null;
  }

  const originalOperation = yield* decodeOperation(toolCall.input).pipe(
    Effect.option
  );
  const input = Option.match(originalOperation, {
    onNone: () => repairedInput.value,
    onSome: ({ operation }) => ({ ...repairedInput.value, operation }),
  });

  return {
    ...toolCall,
    input: JSON.stringify(input, null, 2),
  };
});
