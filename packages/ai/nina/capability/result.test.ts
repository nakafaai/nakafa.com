// @vitest-environment node

import {
  recordSpecialistUsage,
  recoverSpecialistFailure,
  specialistSuccess,
} from "@repo/ai/nina/capability/result";
import type { NinaReporter } from "@repo/ai/nina/runtime/report";
import type { ToolName } from "@repo/ai/schema/tools";
import type { LanguageModelUsage } from "ai";
import { type Context, Effect, Logger, Option } from "effect";
import { describe, expect, it } from "vitest";

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

describe("nina/capability/result", () => {
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
          reporter: createReporter(reported),
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
    expect(entries.map((entry) => entry.logLevel.label)).toEqual(["WARN"]);
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
        reporter: createReporter(reported),
      }).pipe(Effect.provide(Logger.replace(Logger.defaultLogger, logger)))
    );

    const reportedError = reported[0];
    expect(reportedError).toBeInstanceOf(Error);
    if (reportedError instanceof Error) {
      expect(reportedError.message).toBe("content lookup failed");
    }
    expect(entries.map((entry) => entry.logLevel.label)).toEqual([]);
    expect(Option.isNone(result.usage)).toBe(true);
    expect(result.text).toContain("Specialist: nakafa");
    expect(result.text).toContain("Do not invent facts");
  });
});

/** Creates the diagnostics service used by specialist recovery tests. */
function createReporter(reported: unknown[]) {
  return {
    report: ({ error }: { readonly error: unknown }) =>
      Effect.sync(() => {
        reported.push(error);
      }),
  } satisfies Context.Tag.Service<typeof NinaReporter>;
}
