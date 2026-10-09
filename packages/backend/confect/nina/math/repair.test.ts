import { afterEach, describe, expect, it } from "@effect/vitest";
import { createEffectSchema } from "@repo/backend/confect/nina/contract/sdk";
import { repairMathToolCall } from "@repo/backend/confect/nina/math/repair";
import {
  mathAlgebraInput,
  mathEquationInput,
} from "@repo/backend/confect/nina/math/schema";
import { provider } from "@repo/backend/test/gateway";
import {
  providerStep,
  runSpecialist,
  specialistRequest,
} from "@repo/backend/test/nina/specialist";
import { encodeJsonText, JsonTextSchema } from "@repo/utilities/json";
import { InvalidToolInputError, NoSuchToolError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { Schema } from "effect";

afterEach(() => {
  vi.restoreAllMocks();
  provider.languageModel.mockReset();
});
const toolCall = {
  type: "tool-call" as const,
  toolCallId: "math",
  toolName: "algebra",
  input: '{"operation":"simplify"}',
};
const options = {
  instructions: undefined,
  error: new InvalidToolInputError({
    toolName: "algebra",
    toolInput: toolCall.input,
    cause: new Error("Expression missing"),
  }),
  inputSchema: () => Promise.resolve(mathAlgebraInput.jsonSchema),
  messages: [],
  tools: { algebra: { inputSchema: mathAlgebraInput } },
  toolCall,
  task: "Simplify x + x",
  modelId: specialistRequest.modelId,
  usageHandler: vi.fn(),
};
const repaired = { operation: "simplify", expression: "x + x" };

describe("Math tool repair with the Agent component", () => {
  it.each([undefined, "Keep the exact expressions"])(
    "preserves the requested operation and instructions %s",
    async (instructions) => {
      const model = new MockLanguageModelV4({
        doGenerate: providerStep([
          {
            type: "text",
            text: encodeJsonText({
              ...repaired,
              operation: "factor",
            }),
          },
        ]),
      });
      provider.languageModel.mockReturnValue(model);
      const usageHandler = vi.fn();
      const result = await runSpecialist((userId) =>
        repairMathToolCall({ ...options, userId, instructions, usageHandler })
      );
      expect(result).toMatchObject({
        toolName: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
      });
      expect(
        Schema.decodeSync(JsonTextSchema)(result?.input ?? "null")
      ).toEqual(repaired);
      expect(usageHandler).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          agentName: "math-repair",
          userId: expect.any(String),
        })
      );
      expect(encodeJsonText(model.doGenerateCalls[0]?.prompt)).toContain(
        options.task
      );
    }
  );

  it.each(['{"expression":"x + x"}', '{"operation":'])(
    "repairs incomplete JSON %s from the original task",
    async (input) => {
      const model = new MockLanguageModelV4({
        doGenerate: providerStep([
          { type: "text", text: encodeJsonText(repaired) },
        ]),
      });
      provider.languageModel.mockReturnValue(model);
      const result = await runSpecialist((userId) =>
        repairMathToolCall({
          ...options,
          userId,
          toolCall: { ...toolCall, input },
        })
      );
      expect(
        Schema.decodeSync(JsonTextSchema)(result?.input ?? "null")
      ).toEqual(repaired);
      expect(encodeJsonText(model.doGenerateCalls[0]?.prompt)).toContain(
        "# Failed Arguments"
      );
    }
  );

  it("preserves bounds and inclusivity while repairing an equation system", async () => {
    const bounded = {
      operation: "solve",
      expressions: ["x^2 = 1", "y = 0"],
      lower: "0",
      lowerInclusive: false,
      variable: "x",
      variables: ["x", "y"],
    };
    const model = new MockLanguageModelV4({
      doGenerate: providerStep([
        { type: "text", text: encodeJsonText(bounded) },
      ]),
    });
    provider.languageModel.mockReturnValue(model);
    const result = await runSpecialist((userId) =>
      repairMathToolCall({
        ...options,
        userId,
        task: "Solve x^2 = 1, y = 0, with x > 0",
        toolCall: {
          ...toolCall,
          toolName: "equation",
          input: encodeJsonText({
            ...bounded,
            variable: undefined,
          }),
        },
        tools: { equation: { inputSchema: mathEquationInput } },
        inputSchema: () => Promise.resolve(mathEquationInput.jsonSchema),
      })
    );
    expect(Schema.decodeSync(JsonTextSchema)(result?.input ?? "null")).toEqual(
      bounded
    );
  });

  it.each(["unknown", "missing", "schema"] as const)(
    "does not invoke a model for %s tools",
    async (reason) => {
      const result = await runSpecialist((userId) =>
        repairMathToolCall({
          ...options,
          userId,
          error:
            reason === "unknown"
              ? new NoSuchToolError({ toolName: "algebra" })
              : options.error,
          tools: reason === "missing" ? {} : options.tools,
          inputSchema:
            reason === "schema"
              ? () => Promise.reject(new Error("Missing schema"))
              : options.inputSchema,
        })
      );
      expect(result).toBeNull();
      expect(provider.languageModel).not.toHaveBeenCalled();
    }
  );

  it.each(["provider", "output", "primitive"] as const)(
    "declines an unusable %s repair",
    async (failure) => {
      const model = new MockLanguageModelV4({
        doGenerate:
          failure === "provider"
            ? () => Promise.reject(new Error("Unavailable"))
            : providerStep([
                {
                  type: "text",
                  text:
                    failure === "primitive"
                      ? '"unexpected string"'
                      : "not JSON",
                },
              ]),
      });
      provider.languageModel.mockReturnValue(model);
      const result = await runSpecialist((userId) =>
        repairMathToolCall({
          ...options,
          userId,
          tools:
            failure === "primitive"
              ? { algebra: { inputSchema: createEffectSchema(Schema.String) } }
              : options.tools,
        })
      );
      expect(result).toBeNull();
    }
  );
});
