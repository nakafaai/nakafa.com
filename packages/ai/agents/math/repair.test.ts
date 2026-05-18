import { repairMathToolCall } from "@repo/ai/agents/math/repair";
import { mathAlgebraInput } from "@repo/ai/agents/math/schema";
import type { JSONSchema7 } from "ai";
import { InvalidToolInputError, NoSuchToolError, tool } from "ai";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const generateText = vi.hoisted(() => vi.fn());

vi.mock("@repo/ai/config/vercel", () => ({
  gatewayProviderOptions: { sort: "ttft" },
  model: {
    languageModel: (modelId: string) => modelId,
  },
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();

  return {
    ...actual,
    generateText,
  };
});

const tools = {
  algebra: tool({
    description: "Algebra",
    inputSchema: mathAlgebraInput,
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

const inputSchema = vi.fn(() => Promise.resolve(algebraSchema));

afterEach(() => {
  generateText.mockReset();
  inputSchema.mockClear();
});

describe("math tool repair", () => {
  it("repairs invalid math arguments from the original task", async () => {
    generateText.mockResolvedValue({
      output: {
        expression: "(x^2 - 9)/(x - 3)",
        operation: "simplify",
      },
    });

    const repaired = await Effect.runPromise(
      repairMathToolCall({
        error: invalidInputError,
        inputSchema,
        messages: [],
        modelId: "nakafa-lite",
        system: "system",
        task: "Sederhanakan (x^2 - 9)/(x - 3)",
        toolCall,
        tools,
      })
    );

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
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "nakafa-lite",
        prompt: expect.stringContaining("# Original User Request"),
        system: "system",
      })
    );
    expect(inputSchema).toHaveBeenCalledWith(toolCall);
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.not.stringContaining("student request"),
      })
    );
  });

  it("keeps the failed operation when the repair model changes it", async () => {
    generateText.mockResolvedValue({
      output: {
        expression: "(x^2 - 9)/(x - 3)",
        operation: "factor",
      },
    });

    const repaired = await Effect.runPromise(
      repairMathToolCall({
        error: invalidInputError,
        inputSchema,
        messages: [],
        modelId: "nakafa-lite",
        system: "system",
        task: "Sederhanakan (x^2 - 9)/(x - 3)",
        toolCall,
        tools,
      })
    );

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
  });

  it("does not repair when the repair output is not object-shaped", async () => {
    generateText.mockResolvedValue({ output: null });

    const repaired = await Effect.runPromise(
      repairMathToolCall({
        error: invalidInputError,
        inputSchema,
        messages: [],
        modelId: "nakafa-lite",
        system: "system",
        task: "Sederhanakan x",
        toolCall,
        tools,
      })
    );

    expect(repaired).toBeNull();
  });

  it("uses repaired arguments when the failed call has no operation field", async () => {
    generateText.mockResolvedValue({
      output: {
        expression: "(x^2 - 9)/(x - 3)",
        operation: "simplify",
      },
    });

    const incompleteToolCall = {
      ...toolCall,
      input: JSON.stringify({ expression: "(x^2 - 9)/(x - 3)" }),
    };

    const repaired = await Effect.runPromise(
      repairMathToolCall({
        error: invalidInputError,
        inputSchema,
        messages: [],
        modelId: "nakafa-lite",
        system: "system",
        task: "Sederhanakan (x^2 - 9)/(x - 3)",
        toolCall: incompleteToolCall,
        tools,
      })
    );

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
  });

  it("does not repair unavailable tools", async () => {
    const repaired = await Effect.runPromise(
      repairMathToolCall({
        error: new NoSuchToolError({ toolName: "unknown" }),
        inputSchema,
        messages: [],
        modelId: "nakafa-lite",
        system: "system",
        task: "Sederhanakan x",
        toolCall: { ...toolCall, toolName: "unknown" },
        tools,
      })
    );

    expect(repaired).toBeNull();
    expect(generateText).not.toHaveBeenCalled();
  });

  it("does not repair missing tool definitions", async () => {
    const repaired = await Effect.runPromise(
      repairMathToolCall({
        error: invalidInputError,
        inputSchema,
        messages: [],
        modelId: "nakafa-lite",
        system: "system",
        task: "Sederhanakan x",
        toolCall,
        tools: {},
      })
    );

    expect(repaired).toBeNull();
    expect(generateText).not.toHaveBeenCalled();
  });

  it("does not repair when schema lookup fails", async () => {
    const repaired = await Effect.runPromise(
      repairMathToolCall({
        error: invalidInputError,
        inputSchema: () => Promise.reject(new Error("schema unavailable")),
        messages: [],
        modelId: "nakafa-lite",
        system: "system",
        task: "Sederhanakan x",
        toolCall,
        tools,
      })
    );

    expect(repaired).toBeNull();
    expect(generateText).not.toHaveBeenCalled();
  });

  it("does not repair when the repair model fails", async () => {
    generateText.mockRejectedValue(new Error("model unavailable"));

    const repaired = await Effect.runPromise(
      repairMathToolCall({
        error: invalidInputError,
        inputSchema,
        messages: [],
        modelId: "nakafa-lite",
        system: "system",
        task: "Sederhanakan x",
        toolCall,
        tools,
      })
    );

    expect(repaired).toBeNull();
  });
});
