import { gatewayProviderOptions } from "@repo/ai/config/gateway-options";
import {
  defaultModel,
  getFastModelProviderOptions,
  getModelCreditCost,
  getModelGatewayId,
  getModelProviderOptions,
  hasEnoughCredits,
  isModelId,
  MODEL_IDS,
} from "@repo/ai/config/models";
import { describe, expect, it } from "vitest";

describe("Nakafa model registry", () => {
  it("stores only public Nakafa model IDs", () => {
    expect(MODEL_IDS).toEqual(["nakafa-lite", "nakafa-pro"]);
    expect(defaultModel).toBe("nakafa-lite");
    expect(isModelId("nakafa-lite")).toBe(true);
    expect(isModelId("nakafa-pro")).toBe(true);
    expect(isModelId("google/gemini-3.5-flash")).toBe(false);
  });

  it("keeps credit costs and gateway mapping explicit", () => {
    expect(getModelCreditCost("nakafa-lite")).toBe(2);
    expect(getModelCreditCost("nakafa-pro")).toBe(5);
    expect(hasEnoughCredits(1, "nakafa-lite")).toBe(false);
    expect(hasEnoughCredits(2, "nakafa-lite")).toBe(true);
    expect(hasEnoughCredits(4, "nakafa-pro")).toBe(false);
    expect(hasEnoughCredits(5, "nakafa-pro")).toBe(true);
    expect(getModelGatewayId("nakafa-lite")).toBe(
      "google/gemini-3.1-flash-lite"
    );
    expect(getModelGatewayId("nakafa-pro")).toBe("google/gemini-3.5-flash");
  });

  it("uses interactive and fast Gemini thinking profiles", () => {
    expect(getModelProviderOptions("nakafa-lite")).toEqual({
      thinkingConfig: {
        includeThoughts: true,
        thinkingLevel: "high",
      },
    });
    expect(getModelProviderOptions("nakafa-pro")).toEqual({
      thinkingConfig: {
        includeThoughts: true,
        thinkingLevel: "high",
      },
    });
    expect(getFastModelProviderOptions("nakafa-lite")).toEqual({
      thinkingConfig: {
        thinkingLevel: "low",
      },
    });
    expect(getFastModelProviderOptions("nakafa-pro")).toEqual({
      thinkingConfig: {
        thinkingLevel: "low",
      },
    });
    expect(gatewayProviderOptions).toEqual({ sort: "ttft" });
  });
});
