import {
  type EvalCase,
  EvalCaseResult,
  EvalRun,
  type EvalRunError,
  type EvalSuite,
} from "@repo/ai/eval/spec";
import { Clock, Context, Effect } from "effect";

/** Effect service that renders one eval case through the target Module seam. */
export class EvalRenderer extends Context.Tag("EvalRenderer")<
  EvalRenderer,
  {
    readonly render: (
      testCase: EvalCase
    ) => Effect.Effect<string, EvalRunError>;
  }
>() {}

/** Checks one rendered eval case against its schema-owned expectations. */
export function evaluateRenderedCase(testCase: EvalCase, rendered: string) {
  const missing = testCase.expectations.flatMap((expectation) =>
    rendered.includes(expectation.includes) ? [] : [expectation.label]
  );

  return EvalCaseResult.make({
    id: testCase.id,
    missing,
    status: missing.length === 0 ? "passed" : "failed",
  });
}

/** Runs a deterministic eval suite through the provided EvalRenderer service. */
export const runEvalSuite = Effect.fn("eval.runSuite")(function* (
  suite: EvalSuite
) {
  const renderer = yield* EvalRenderer;
  const startedAt = yield* Clock.currentTimeMillis;
  const results: EvalCaseResult[] = [];

  for (const testCase of suite.cases) {
    const rendered = yield* renderer.render(testCase);
    results.push(evaluateRenderedCase(testCase, rendered));
  }

  const endedAt = yield* Clock.currentTimeMillis;

  return EvalRun.make({
    endedAt,
    results,
    startedAt,
    suite: suite.name,
  });
});
