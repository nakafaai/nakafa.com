import {
  defaultModel,
  getFastModelProviderOptions,
  getModelCreditCost,
  getModelGatewayId,
  getModelProviderOptions,
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
    expect(isModelId("google/gemini-3.5-flash")).toBe(false);
  });

  it("keeps credit costs and gateway mapping explicit", () => {
    expect(
      MODEL_IDS.map((modelId) =>
        Schema.decodeUnknownSync(ModelInfoSchema)(modelRegistry[modelId])
      )
    ).toEqual([
      {
        credits: 2,
        gatewayId: "google/gemini-3.1-flash-lite",
      },
      {
        credits: 5,
        gatewayId: "google/gemini-3.5-flash",
      },
    ]);
    expect(getModelCreditCost(liteModel)).toBe(2);
    expect(getModelCreditCost(proModel)).toBe(5);
    expect(hasEnoughCredits(1, liteModel)).toBe(false);
    expect(hasEnoughCredits(2, liteModel)).toBe(true);
    expect(hasEnoughCredits(4, proModel)).toBe(false);
    expect(hasEnoughCredits(5, proModel)).toBe(true);
    expect(getModelGatewayId(liteModel)).toBe("google/gemini-3.1-flash-lite");
    expect(getModelGatewayId(proModel)).toBe("google/gemini-3.5-flash");
  });

  it("uses interactive and fast Gemini thinking profiles", () => {
    expect(getModelProviderOptions(liteModel)).toEqual({
      thinkingConfig: {
        includeThoughts: true,
        thinkingLevel: "high",
      },
    });
    expect(getModelProviderOptions(proModel)).toEqual({
      thinkingConfig: {
        includeThoughts: true,
        thinkingLevel: "high",
      },
    });
    expect(getFastModelProviderOptions(liteModel)).toEqual({
      thinkingConfig: {
        thinkingLevel: "low",
      },
    });
    expect(getFastModelProviderOptions(proModel)).toEqual({
      thinkingConfig: {
        thinkingLevel: "low",
      },
    });
    expect(gatewayProviderOptions).toEqual({ sort: "ttft" });
  });
});
