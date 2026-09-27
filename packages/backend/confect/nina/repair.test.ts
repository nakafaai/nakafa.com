import { afterEach, describe, expect, it } from "@effect/vitest";
import { getGatewayModel } from "@repo/backend/confect/nina/config/provider";
import {
  mathToolInputSchema,
  nakafaToolInputSchema,
  researchToolInputSchema,
} from "@repo/backend/confect/nina/contract/tools";
import { repairToolCall } from "@repo/backend/confect/nina/repair";
import { ninaToolInput } from "@repo/backend/test/nina";
import {
  providerStep,
  runSpecialist,
} from "@repo/backend/test/nina/specialist";
import { InvalidToolInputError, type ModelMessage, NoSuchToolError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { Effect } from "effect";

vi.mock("@repo/backend/confect/nina/config/provider", () => ({
  getGatewayModel: vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());
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
  messages: [],
  tools,
  toolCall,
  needsPageFetch: false,
  url: "https://nakafa.com/en/home",
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
      expect(getGatewayModel).not.toHaveBeenCalled();
    }
  );

  it.each([false, true])(
    "repairs a known task and records usage after existing page result %s",
    async (hasPage) => {
      const model = new MockLanguageModelV4({
        doGenerate: providerStep([
          { type: "text", text: JSON.stringify(ninaToolInput) },
        ]),
      });
      vi.mocked(getGatewayModel).mockReturnValue(Effect.succeed(model));
      const usageHandler = vi.fn();
      const messages: ModelMessage[] = hasPage
        ? [
            { role: "user", content: "Read related evidence" },
            {
              role: "tool",
              content: [
                {
                  type: "tool-result",
                  toolName: "nakafa",
                  toolCallId: "page",
                  output: { type: "text", value: "Page already retrieved" },
                },
              ],
            },
          ]
        : [{ role: "user", content: "Read related evidence" }];
      const result = await runSpecialist((userId) =>
        repairToolCall({
          ...options,
          userId,
          messages,
          needsPageFetch: hasPage,
          usageHandler,
        })
      );
      expect(result).toEqual({
        ...toolCall,
        input: JSON.stringify(ninaToolInput),
      });
      expect(usageHandler).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          agentName: "nina-repair",
          userId: expect.any(String),
        })
      );
      expect(JSON.stringify(model.doGenerateCalls[0]?.prompt)).toContain(
        "Keep the original task and source constraints"
      );
    }
  );

  it("uses verified page context for the first read without a model call", async () => {
    const result = await runSpecialist((userId) =>
      repairToolCall({
        ...options,
        userId,
        needsPageFetch: true,
        messages: [
          {
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolName: "math",
                toolCallId: "other",
                output: { type: "text", value: "2" },
              },
            ],
          },
        ],
      })
    );
    expect(result?.input).toContain(options.url);
    expect(getGatewayModel).not.toHaveBeenCalled();
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
      vi.mocked(getGatewayModel).mockReturnValue(Effect.succeed(model));
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
        expect(getGatewayModel).not.toHaveBeenCalled();
      }
    }
  );
});
