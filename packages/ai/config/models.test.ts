import { gatewayProviderOptions } from "@repo/ai/config/gateway-options";
import {
  defaultModel,
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
    expect(isModelId("google/gemini-3-pro-preview")).toBe(false);
  });

  it("keeps credit costs and gateway mapping explicit", () => {
    expect(getModelCreditCost("nakafa-lite")).toBe(1);
    expect(getModelCreditCost("nakafa-pro")).toBe(3);
    expect(hasEnoughCredits(1, "nakafa-lite")).toBe(true);
    expect(hasEnoughCredits(2, "nakafa-pro")).toBe(false);
    expect(getModelGatewayId("nakafa-lite")).toBe(
      "google/gemini-3.1-flash-lite"
    );
    expect(getModelGatewayId("nakafa-pro")).toBe("google/gemini-3-pro-preview");
  });

  it("uses high Gemini thinking and keeps Gateway provider fallback open", () => {
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
    expect(gatewayProviderOptions).toEqual({ sort: "ttft" });
  });
});
