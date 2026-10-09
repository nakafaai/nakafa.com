import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  mathToolInputSchema,
  NakafaToolInputSchema,
  nakafaToolInputSchema,
  researchToolInputSchema,
} from "@repo/backend/confect/nina/contract/tools";
import { repairToolCall } from "@repo/backend/confect/nina/repair";
import { provider } from "@repo/backend/test/gateway";
import { ninaToolInput } from "@repo/backend/test/nina";
import {
  providerStep,
  runSpecialist,
} from "@repo/backend/test/nina/specialist";
import { encodeJsonText } from "@repo/utilities/json";
import { InvalidToolInputError, NoSuchToolError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { Schema } from "effect";

afterEach(() => {
  vi.restoreAllMocks();
  provider.languageModel.mockReset();
});
const nakafaInputJsonSchema = Schema.fromJsonString(NakafaToolInputSchema);
const tools = {
  nakafa: { inputSchema: nakafaToolInputSchema },
  math: { inputSchema: mathToolInputSchema },
  deepResearch: { inputSchema: researchToolInputSchema },
};
const toolCall = {
  type: "tool-call" as const,
  toolCallId: "read",
  toolName: "nakafa",
  input: "{}",
};
const options = {
  instructions: undefined,
  error: new InvalidToolInputError({
    toolName: "nakafa",
    toolInput: "{}",
    cause: new Error("Missing task"),
  }),
  inputSchema: () => Promise.resolve(nakafaToolInputSchema.jsonSchema),
  tools,
  toolCall,
  usageHandler: vi.fn(),
};

describe("Nina tool repair with the Agent component", () => {
  it.each([true, false])(
    "declines unknown tools with SDK missing-tool error %s",
    async (missing) => {
      const result = await runSpecialist((userId) =>
        repairToolCall({
          ...options,
          userId,
          toolCall: { ...toolCall, toolName: "unknown" },
          error: missing
            ? new NoSuchToolError({ toolName: "unknown" })
            : options.error,
        })
      );
      expect(result).toBeNull();
      expect(provider.languageModel).not.toHaveBeenCalled();
    }
  );

  it("repairs a known task through the model and records usage", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: providerStep([
        {
          type: "text",
          text: Schema.encodeSync(nakafaInputJsonSchema)(ninaToolInput),
        },
      ]),
    });
    provider.languageModel.mockReturnValue(model);
    const usageHandler = vi.fn();
    const result = await runSpecialist((userId) =>
      repairToolCall({ ...options, userId, usageHandler })
    );
    expect(result).toEqual({
      ...toolCall,
      input: Schema.encodeSync(nakafaInputJsonSchema)(ninaToolInput),
    });
    expect(usageHandler).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        agentName: "nina-repair",
        userId: expect.any(String),
      })
    );
    expect(encodeJsonText(model.doGenerateCalls[0]?.prompt)).toContain(
      "Keep the original task and source constraints"
    );
  });

  it.each(["schema", "provider", "output"] as const)(
    "returns an unavailable repair for %s failure",
    async (phase) => {
      const model = new MockLanguageModelV4({
        doGenerate:
          phase === "provider"
            ? () => Promise.reject(new Error("Private provider failure"))
            : providerStep([{ type: "text", text: "not JSON" }]),
      });
      provider.languageModel.mockReturnValue(model);
      const result = await runSpecialist((userId) =>
        repairToolCall({
          ...options,
          userId,
          inputSchema:
            phase === "schema"
              ? () => Promise.reject(new Error("Schema unavailable"))
              : options.inputSchema,
        })
      );
      expect(result).toBeNull();
      if (phase === "schema") {
        expect(provider.languageModel).not.toHaveBeenCalled();
      }
    }
  );
});
