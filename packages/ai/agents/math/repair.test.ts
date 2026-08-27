import { afterEach, describe, expect, it } from "@effect/vitest";
import { repairMathToolCall } from "@repo/ai/agents/math/repair";
import {
  mathAlgebraInput,
  mathEquationInput,
} from "@repo/ai/agents/math/schema";
import { ModelIdSchema } from "@repo/ai/config/model";
import type { JSONSchema7, ToolCallRepairFunction, ToolSet } from "ai";
import { generateText, InvalidToolInputError, NoSuchToolError, tool } from "ai";
import { Effect } from "effect";
import { vi } from "vitest";

const generateTextMock = vi.hoisted(() => vi.fn());

vi.mock("ai", { spy: true });
vi.mocked(generateText).mockImplementation(generateTextMock);

vi.mock("@repo/ai/config/app", () => ({
  provider: {
    languageModel: (modelId: string) => modelId,
  },
}));

const tools = {
  algebra: tool({
    description: "Algebra",
    inputSchema: mathAlgebraInput,
  }),
  equation: tool({
    description: "Equation",
    inputSchema: mathEquationInput,
  }),
};

const toolCall = {
  input: JSON.stringify({ operation: "simplify" }),
  toolCallId: "math-1",
  toolName: "algebra",
  type: "tool-call" as const,
};

const algebraSchema = {
  additionalProperties: false,
  properties: {
    expression: { type: "string" },
    operation: { const: "simplify" },
  },
  required: ["expression", "operation"],
  type: "object",
} satisfies JSONSchema7;

const invalidInputError = new InvalidToolInputError({
  cause: new Error("Expression is required."),
  toolInput: toolCall.input,
  toolName: toolCall.toolName,
});

const inputSchema = vi.fn<
  Parameters<ToolCallRepairFunction<ToolSet>>[0]["inputSchema"]
>(() => Promise.resolve(algebraSchema));
const modelId = ModelIdSchema.make("nakafa-lite");

afterEach(() => {
  generateTextMock.mockReset();
  inputSchema.mockClear();
});

describe("math tool repair", () => {
  it.effect("repairs invalid math arguments from the original task", () =>
    Effect.gen(function* () {
      generateTextMock.mockResolvedValue({
        output: {
          expression: "(x^2 - 9)/(x - 3)",
          operation: "simplify",
        },
      });

      const repaired = yield* repairMathToolCall({
        error: invalidInputError,
        inputSchema,
        messages: [],
        modelId,
        instructions: "instructions",
        task: "Sederhanakan (x^2 - 9)/(x - 3)",
        toolCall,
        tools,
      });

      expect(repaired).toEqual({
        ...toolCall,
        input: JSON.stringify(
          {
            expression: "(x^2 - 9)/(x - 3)",
            operation: "simplify",
          },
          null,
          2
        ),
      });
      expect(generateTextMock).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "nakafa-lite",
          prompt: expect.stringContaining("# Original User Request"),
          instructions: "instructions",
        })
      );
      expect(inputSchema).toHaveBeenCalledWith(toolCall);
      expect(generateTextMock).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.not.stringContaining("student request"),
        })
      );
    })
  );

  it.effect("keeps the failed operation when the repair model changes it", () =>
    Effect.gen(function* () {
      generateTextMock.mockResolvedValue({
        output: {
          expression: "(x^2 - 9)/(x - 3)",
          operation: "factor",
        },
      });

      const repaired = yield* repairMathToolCall({
        error: invalidInputError,
        inputSchema,
        messages: [],
        modelId,
        instructions: "instructions",
        task: "Sederhanakan (x^2 - 9)/(x - 3)",
        toolCall,
        tools,
      });

      expect(repaired).toEqual({
        ...toolCall,
        input: JSON.stringify(
          {
            expression: "(x^2 - 9)/(x - 3)",
            operation: "simplify",
          },
          null,
          2
        ),
      });
    })
  );

  it.effect(
    "preserves valid solve-domain fields while repairing bounded systems",
    () =>
      Effect.gen(function* () {
        const equationToolCall = {
          input: JSON.stringify({
            expressions: ["x^2 = 1", "y = 0"],
            lower: "0",
            lowerInclusive: false,
            operation: "solve",
            variables: ["x", "y"],
          }),
          toolCallId: "math-2",
          toolName: "equation",
          type: "tool-call" as const,
        };
        const equationSchema = {
          properties: {
            expressions: { type: "array" },
            lower: { type: "string" },
            lowerInclusive: { type: "boolean" },
            operation: { const: "solve" },
            variable: { type: "string" },
            variables: { type: "array" },
          },
          required: [],
          type: "object",
        } satisfies JSONSchema7;
        const equationInputError = new InvalidToolInputError({
          cause: new Error("Bounded systems need a variable."),
          toolInput: equationToolCall.input,
          toolName: equationToolCall.toolName,
        });

        inputSchema.mockResolvedValueOnce(equationSchema);
        generateTextMock.mockResolvedValue({
          output: {
            expressions: ["x^2 = 1", "y = 0"],
            lower: "0",
            lowerInclusive: false,
            operation: "solve",
            variable: "x",
            variables: ["x", "y"],
          },
        });

        const repaired = yield* repairMathToolCall({
          error: equationInputError,
          inputSchema,
          messages: [],
          modelId,
          instructions: "instructions",
          task: "x^2 = 1, y = 0, and x > 0",
          toolCall: equationToolCall,
          tools,
        });

        expect(repaired).toMatchObject({
          ...equationToolCall,
          input: expect.any(String),
        });
        expect(JSON.parse(repaired?.input ?? "{}")).toEqual({
          expressions: ["x^2 = 1", "y = 0"],
          lower: "0",
          lowerInclusive: false,
          operation: "solve",
          variable: "x",
          variables: ["x", "y"],
        });
        expect(generateTextMock).toHaveBeenCalledWith(
          expect.objectContaining({
            prompt: expect.stringContaining('"lower": "0"'),
          })
        );
        expect(generateTextMock).toHaveBeenCalledWith(
          expect.objectContaining({
            prompt: expect.stringContaining("Do not drop bounds"),
          })
        );
      })
  );

  it.effect("does not repair when the repair output is not object-shaped", () =>
    Effect.gen(function* () {
      generateTextMock.mockResolvedValue({ output: null });

      const repaired = yield* repairMathToolCall({
        error: invalidInputError,
        inputSchema,
        messages: [],
        modelId,
        instructions: "instructions",
        task: "Sederhanakan x",
        toolCall,
        tools,
      });

      expect(repaired).toBeNull();
    })
  );

  it.effect(
    "uses repaired arguments when the failed call has no operation field",
    () =>
      Effect.gen(function* () {
        generateTextMock.mockResolvedValue({
          output: {
            expression: "(x^2 - 9)/(x - 3)",
            operation: "simplify",
          },
        });

        const incompleteToolCall = {
          ...toolCall,
          input: JSON.stringify({ expression: "(x^2 - 9)/(x - 3)" }),
        };

        const repaired = yield* repairMathToolCall({
          error: invalidInputError,
          inputSchema,
          messages: [],
          modelId,
          instructions: "instructions",
          task: "Sederhanakan (x^2 - 9)/(x - 3)",
          toolCall: incompleteToolCall,
          tools,
        });

        expect(repaired).toEqual({
          ...incompleteToolCall,
          input: JSON.stringify(
            {
              expression: "(x^2 - 9)/(x - 3)",
              operation: "simplify",
            },
            null,
            2
          ),
        });
      })
  );

  it.effect(
    "keeps malformed failed arguments readable in the repair prompt",
    () =>
      Effect.gen(function* () {
        generateTextMock.mockResolvedValue({
          output: {
            expression: "(x^2 - 9)/(x - 3)",
            operation: "simplify",
          },
        });

        const malformedToolCall = {
          ...toolCall,
          input: '{"operation":"simplify"',
        };

        const repaired = yield* repairMathToolCall({
          error: invalidInputError,
          inputSchema,
          messages: [],
          modelId,
          instructions: "instructions",
          task: "Sederhanakan (x^2 - 9)/(x - 3)",
          toolCall: malformedToolCall,
          tools,
        });

        expect(repaired).toEqual({
          ...malformedToolCall,
          input: JSON.stringify(
            {
              expression: "(x^2 - 9)/(x - 3)",
              operation: "simplify",
            },
            null,
            2
          ),
        });
        expect(generateTextMock).toHaveBeenCalledWith(
          expect.objectContaining({
            prompt: expect.stringContaining('{"operation":"simplify"'),
          })
        );
      })
  );

  it.effect("does not repair unavailable tools", () =>
    Effect.gen(function* () {
      const repaired = yield* repairMathToolCall({
        error: new NoSuchToolError({ toolName: "unknown" }),
        inputSchema,
        messages: [],
        modelId,
        instructions: "instructions",
        task: "Sederhanakan x",
        toolCall: { ...toolCall, toolName: "unknown" },
        tools,
      });

      expect(repaired).toBeNull();
      expect(generateTextMock).not.toHaveBeenCalled();
    })
  );

  it.effect("does not repair missing tool definitions", () =>
    Effect.gen(function* () {
      const repaired = yield* repairMathToolCall({
        error: invalidInputError,
        inputSchema,
        messages: [],
        modelId,
        instructions: "instructions",
        task: "Sederhanakan x",
        toolCall,
        tools: {},
      });

      expect(repaired).toBeNull();
      expect(generateTextMock).not.toHaveBeenCalled();
    })
  );

  it.effect("does not repair when schema lookup fails", () =>
    Effect.gen(function* () {
      const repaired = yield* repairMathToolCall({
        error: invalidInputError,
        inputSchema: () => Promise.reject(new Error("schema unavailable")),
        messages: [],
        modelId,
        instructions: "instructions",
        task: "Sederhanakan x",
        toolCall,
        tools,
      });

      expect(repaired).toBeNull();
      expect(generateTextMock).not.toHaveBeenCalled();
    })
  );

  it.effect("does not repair when the repair model fails", () =>
    Effect.gen(function* () {
      generateTextMock.mockRejectedValue(new Error("model unavailable"));

      const repaired = yield* repairMathToolCall({
        error: invalidInputError,
        inputSchema,
        messages: [],
        modelId,
        instructions: "instructions",
        task: "Sederhanakan x",
        toolCall,
        tools,
      });

      expect(repaired).toBeNull();
    })
  );
});
