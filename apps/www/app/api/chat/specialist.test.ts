// @vitest-environment node
import type { ToolName } from "@repo/ai/schema/tools";
import type { LanguageModelUsage } from "ai";
import { Effect, HashMap, Logger, Option } from "effect";
import { describe, expect, it } from "vitest";
import {
  recordSpecialistUsage,
  recoverSpecialistFailure,
  specialistSuccess,
} from "@/app/api/chat/specialist";

const usage = {
  inputTokens: 3,
  inputTokenDetails: {
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    noCacheTokens: 3,
  },
  outputTokens: 5,
  outputTokenDetails: {
    reasoningTokens: 1,
    textTokens: 4,
  },
  totalTokens: 8,
} satisfies LanguageModelUsage;

/** Records usage rows passed through the specialist usage seam. */
function usageRecorder() {
  const rows: { component: ToolName; usage: LanguageModelUsage }[] = [];

  return {
    rows,
    addUsage: (component: ToolName, row: LanguageModelUsage) =>
      Effect.sync(() => {
        rows.push({ component, usage: row });
      }),
  };
}

/** Captures expected Effect logs so failure-path tests keep build logs clean. */
function testLogger() {
  const entries: Logger.Logger.Options<unknown>[] = [];
  const logger = Logger.make((entry) => entries.push(entry));

  return { entries, logger };
}

describe("app/api/chat/specialist", () => {
  it("preserves real usage for successful specialists", async () => {
    const tracker = usageRecorder();
    const result = specialistSuccess({ text: "verified", usage });

    await Effect.runPromise(
      recordSpecialistUsage({
        addUsage: tracker.addUsage,
        component: "math",
        logContext: {},
        result,
      })
    );

    expect(result.text).toBe("verified");
    expect(Option.isSome(result.usage)).toBe(true);
    expect(tracker.rows).toEqual([{ component: "math", usage }]);
  });

  it("does not invent usage when a specialist fails before completion", async () => {
    const tracker = usageRecorder();
    const reported: unknown[] = [];
    const { entries, logger } = testLogger();

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const recovered = yield* recoverSpecialistFailure({
          component: "deepResearch",
          error: new Error("network unavailable"),
          errorLocation: "runResearchAgent",
          logContext: {},
          reportError: (error) => {
            reported.push(error);
          },
        });

        yield* recordSpecialistUsage({
          addUsage: tracker.addUsage,
          component: "deepResearch",
          logContext: {},
          result: recovered,
        });

        return recovered;
      }).pipe(Effect.provide(Logger.replace(Logger.defaultLogger, logger)))
    );

    expect(reported).toHaveLength(1);
    expect(entries.map((entry) => entry.logLevel.label)).toEqual([
      "ERROR",
      "WARN",
    ]);
    expect(Option.isNone(result.usage)).toBe(true);
    expect(tracker.rows).toEqual([]);
    expect(result.text).toContain("Specialist: deepResearch");
    expect(result.text).toContain("Usage returned: none");
  });

  it("normalizes non-Error failures into model-facing recovery evidence", async () => {
    const reported: unknown[] = [];
    const { entries, logger } = testLogger();

    const result = await Effect.runPromise(
      recoverSpecialistFailure({
        component: "nakafa",
        error: "content lookup failed",
        errorLocation: "runNakafaAgent",
        logContext: {},
        reportError: (error) => {
          reported.push(error);
        },
      }).pipe(Effect.provide(Logger.replace(Logger.defaultLogger, logger)))
    );

    expect(reported).toEqual(["content lookup failed"]);
    expect(entries.map((entry) => entry.logLevel.label)).toEqual(["ERROR"]);
    expect(
      Option.getOrUndefined(HashMap.get(entries[0]?.annotations, "component"))
    ).toBe("nakafa");
    expect(Option.isNone(result.usage)).toBe(true);
    expect(result.text).toContain("Specialist: nakafa");
    expect(result.text).toContain("Do not invent facts");
  });
});
