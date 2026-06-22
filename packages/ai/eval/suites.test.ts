// @vitest-environment node

import {
  EvalRenderer,
  evaluateRenderedCase,
  runEvalSuite,
} from "@repo/ai/eval/runner";
import { EvalCase, EvalExpectation } from "@repo/ai/eval/spec";
import { createNinaEvalSuite, renderNinaEvalCase } from "@repo/ai/eval/suites";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("nina deterministic eval suite", () => {
  it("passes every local NinaHarness and LearningCapability eval case", async () => {
    const suite = createNinaEvalSuite();
    const run = await Effect.runPromise(
      runEvalSuite(suite).pipe(
        Effect.provideService(EvalRenderer, {
          render: (testCase) => Effect.succeed(renderNinaEvalCase(testCase)),
        })
      )
    );

    expect(run.suite).toBe("nina-deterministic");
    expect(run.results).toHaveLength(5);
    expect(run.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "math-deterministic-first" }),
        expect.objectContaining({ id: "nakafa-evidence-boundary" }),
        expect.objectContaining({ id: "research-source-boundary" }),
        expect.objectContaining({ id: "trace-summary-boundary" }),
        expect.objectContaining({ id: "turn-pinned-locale" }),
      ])
    );
    expect(run.results.every((result) => result.status === "passed")).toBe(
      true
    );
  });

  it("marks missing deterministic expectations as failed", () => {
    const result = evaluateRenderedCase(
      EvalCase.make({
        id: "missing-proof",
        target: "trace",
        expectations: [
          EvalExpectation.make({
            includes: "bounded trace evidence",
            label: "requires trace evidence",
          }),
        ],
      }),
      "other output"
    );

    expect(result.status).toBe("failed");
    expect(result.missing).toEqual(["requires trace evidence"]);
  });
});
