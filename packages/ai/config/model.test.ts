import {
  defaultModel,
  getBackgroundModelReasoning,
  getInteractiveModelReasoning,
  getModelCreditCost,
  getModelGatewayId,
  hasEnoughCredits,
  isModelId,
  MODEL_IDS,
  ModelIdSchema,
  ModelInfoSchema,
  modelRegistry,
} from "@repo/ai/config/model";
import { gatewayProviderOptions } from "@repo/ai/config/routing";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("Nakafa model registry", () => {
  const liteModel = ModelIdSchema.make("nakafa-lite");
  const proModel = ModelIdSchema.make("nakafa-pro");

  it("stores only public Nakafa model IDs", () => {
    expect(MODEL_IDS).toEqual(["nakafa-lite", "nakafa-pro"]);
    expect(defaultModel).toBe("nakafa-lite");
    expect(isModelId("nakafa-lite")).toBe(true);
    expect(isModelId("nakafa-pro")).toBe(true);
    expect(isModelId("openai/gpt-5.4-mini")).toBe(false);
  });

  it("keeps credit costs and gateway mapping explicit", () => {
    expect(
      MODEL_IDS.map((modelId) =>
        Schema.decodeSync(ModelInfoSchema)(modelRegistry[modelId])
      )
    ).toEqual([
      {
        credits: 2,
        gatewayId: "openai/gpt-5-mini",
        reasoning: { background: "low", interactive: "high" },
      },
      {
        credits: 5,
        gatewayId: "openai/gpt-5.4-mini",
        reasoning: { background: "low", interactive: "high" },
      },
    ]);
    expect(getModelCreditCost(liteModel)).toBe(2);
    expect(getModelCreditCost(proModel)).toBe(5);
    expect(hasEnoughCredits(1, liteModel)).toBe(false);
    expect(hasEnoughCredits(2, liteModel)).toBe(true);
    expect(hasEnoughCredits(4, proModel)).toBe(false);
    expect(hasEnoughCredits(5, proModel)).toBe(true);
    expect(getModelGatewayId(liteModel)).toBe("openai/gpt-5-mini");
    expect(getModelGatewayId(proModel)).toBe("openai/gpt-5.4-mini");
  });

  it("uses provider-neutral reasoning and OpenAI-only routing", () => {
    expect(getInteractiveModelReasoning(liteModel)).toBe("high");
    expect(getInteractiveModelReasoning(proModel)).toBe("high");
    expect(getBackgroundModelReasoning(liteModel)).toBe("low");
    expect(getBackgroundModelReasoning(proModel)).toBe("low");
    expect(gatewayProviderOptions).toEqual({
      disallowPromptTraining: true,
      only: ["openai"],
    });
  });
});
