import { describe, expect, it } from "@effect/vitest";
import { makeResearchGenerationError } from "@repo/backend/confect/nina/research/error";
import { ResearchGenerationError } from "@repo/backend/confect/nina/research/schema";
import { failures } from "@repo/backend/test/gateway";
import { encodeJsonText } from "@repo/utilities/json";
import { NoObjectGeneratedError } from "ai";
import { DateTime } from "effect";

describe("makeResearchGenerationError", () => {
  it("classifies a failed call through the gateway's vocabulary", () => {
    const error = makeResearchGenerationError(failures["rate-limit"], "search");
    expect(error).toBeInstanceOf(ResearchGenerationError);
    expect(error).toMatchObject({
      gateway: { reason: "rate-limit" },
      message: "Research search generation failed.",
      phase: "search",
      rejected: false,
    });
  });

  it("marks an answer that was not the asked object as rejected and keeps none of it", () => {
    const failure = new NoObjectGeneratedError({
      message: "Output failed validation",
      cause: new Error("Private validation detail"),
      text: '{"private":"Model answer"}',
      response: {
        id: "research-fixture",
        modelId: "fixture",
        timestamp: DateTime.toDateUtc(
          DateTime.makeUnsafe("2026-09-05T00:00:00Z")
        ),
      },
      usage: {
        inputTokens: 10,
        inputTokenDetails: {
          noCacheTokens: 10,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
        outputTokens: 5,
        outputTokenDetails: { textTokens: 5, reasoningTokens: 0 },
        totalTokens: 15,
      },
      finishReason: "stop",
    });
    const error = makeResearchGenerationError(failure, "synthesis");
    expect(error).toMatchObject({
      message: "Research synthesis returned no usable answer.",
      phase: "synthesis",
      rejected: true,
    });
    expect(error.gateway).toBeUndefined();
    const stored = encodeJsonText({ ...error });
    expect(stored).not.toContain("Model answer");
    expect(stored).not.toContain("Private validation detail");
  });

  it("keeps a private provider message out of the typed error", () => {
    const error = makeResearchGenerationError(
      new Error("Private provider detail about the learner's question"),
      "synthesis"
    );
    expect(error.gateway?.reason).toBe("unknown");
    expect(
      encodeJsonText({ ...error, gateway: { ...error.gateway } })
    ).not.toContain("Private provider detail");
  });
});
