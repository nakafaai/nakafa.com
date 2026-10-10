import { describe, expect, it } from "@effect/vitest";
import { makeResearchGenerationError } from "@repo/backend/confect/nina/research/error";
import { ResearchGenerationError } from "@repo/backend/confect/nina/research/schema";
import { NoObjectGeneratedError } from "ai";
import { DateTime, Schema } from "effect";

const CyclicFailureSchema = Schema.Struct({
  cause: Schema.mutableKey(Schema.optionalKey(Schema.Unknown)),
  message: Schema.String,
});

describe("makeResearchGenerationError", () => {
  it.each([
    [new Error("Provider unavailable"), "Provider unavailable"],
    ["Rate limited", "Rate limited"],
    [{ status: 503 }, '{"status":503}'],
    [null, "null"],
    [undefined, undefined],
  ])("retains search failure details for %j", (cause, expected) => {
    const error = makeResearchGenerationError(cause, "search");
    expect(error).toBeInstanceOf(ResearchGenerationError);
    expect(error).toMatchObject({
      _tag: "ResearchGenerationError",
      cause: expected,
      message: "Research search generation failed.",
      phase: "search",
    });
  });

  it("keeps a cyclic provider failure in the typed error channel", () => {
    const failure: typeof CyclicFailureSchema.Type = {
      message: "Provider unavailable",
    };
    failure.cause = failure;
    const error = makeResearchGenerationError(failure, "synthesis");
    expect(error).toBeInstanceOf(ResearchGenerationError);
    expect(error.phase).toBe("synthesis");
    expect(error.cause).toContain("Provider unavailable");
  });

  it("preserves rejected structured output and its SDK cause", () => {
    const failure = new NoObjectGeneratedError({
      message: "Output failed validation",
      cause: new Error("Missing findings"),
      text: '{"unexpected":true}',
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
    expect(makeResearchGenerationError(failure, "synthesis")).toMatchObject({
      cause: "Missing findings",
      message: "Research synthesis generation failed: Output failed validation",
      phase: "synthesis",
      text: '{"unexpected":true}',
    });
    expect(makeResearchGenerationError(failure, "search")).toMatchObject({
      cause: "Output failed validation",
      phase: "search",
    });
  });
});
