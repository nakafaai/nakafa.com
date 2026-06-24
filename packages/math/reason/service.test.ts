import { CasEngine } from "@repo/math/cas/engine";
import { MathCasRequestError } from "@repo/math/errors";
import {
  MathCasAdapterError,
  MathReasoningInputError,
} from "@repo/math/reason/errors";
import {
  MathWorkRepository,
  NoopMathWorkRepository,
} from "@repo/math/reason/repo";
import { MathReasoning } from "@repo/math/reason/service";
import type { MathRequest } from "@repo/math/schema/request";
import type { MathResult } from "@repo/math/schema/result";
import type { MathWorkResult } from "@repo/math/schema/work";
import { ConfigProvider, Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

const config = ConfigProvider.fromMap(new Map());

describe("MathReasoning", () => {
  it("produces canonical MathWork through the deep Interface", async () => {
    const saved: MathWorkResult[] = [];
    const exit = await Effect.runPromiseExit(
      MathReasoning.produceWork({
        givens: ["x^2 - 1 = 0"],
        locale: "id",
        objective: "Solve the equation",
        persistence: "persist",
        request: "solve x^2 - 1 = 0",
      }).pipe(
        Effect.provide(MathReasoning.Default),
        Effect.provideService(CasEngine, fakeCasEngine(solveResult())),
        Effect.provideService(MathWorkRepository, {
          save: (result) =>
            Effect.sync(() => {
              saved.push(result);
            }),
        }),
        Effect.withConfigProvider(config)
      )
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      return;
    }

    expect(exit.value.work.verification.lane).toBe("verified");
    expect(exit.value.steps[0]?.verificationLane).toBe("derived");
    expect(exit.value.artifacts.map((artifact) => artifact.kind)).toEqual([
      "formula-card",
      "step-list",
    ]);
    expect(exit.value.artifacts[0]?.titleKey).toBe("math-solve");
    expect(exit.value.steps[0]?.projection.school.key).toBe("math-step-school");
    expect(saved).toHaveLength(1);
  });

  it("projects coordinate VisualIntent and preserves speculative lanes", async () => {
    const exit = await Effect.runPromiseExit(
      MathReasoning.produceWork({
        givens: ["(0, 0)", "(3, 2)"],
        locale: "id",
        objective: "Find the line",
        persistence: "none",
        request: "line through (0, 0) and (3, 2)",
      }).pipe(
        Effect.provide(MathReasoning.Default),
        Effect.provideService(CasEngine, fakeCasEngine(lineResult())),
        Effect.provideService(MathWorkRepository, {
          save: () => Effect.void,
        }),
        Effect.withConfigProvider(config)
      )
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      return;
    }

    expect(exit.value.work.status).toBe("limited");
    expect(exit.value.work.limitations[0]?.lane).toBe("speculative");
    expect(exit.value.work.limitations[0]?.copyKey).toBe(
      "math-limitation-cas-inconclusive"
    );
    const visualArtifact = exit.value.artifacts.find(
      (artifact) => artifact.kind === "visual-intent"
    );

    expect(visualArtifact?.manifest.kind).toBe("visual-intent");
    if (visualArtifact?.manifest.kind !== "visual-intent") {
      return;
    }

    expect(visualArtifact.manifest.visualIntent.descriptionKey).toBe(
      "math-visual-coordinate-line-description"
    );
  });

  it("keeps invalid input and CAS failures in typed Effect errors", async () => {
    const inputExit = await Effect.runPromiseExit(
      MathReasoning.produceWork({ request: "" }).pipe(
        Effect.provide(MathReasoning.Default),
        Effect.provideService(CasEngine, fakeCasEngine(solveResult())),
        Effect.provide(NoopMathWorkRepository),
        Effect.withConfigProvider(config)
      )
    );
    const casExit = await Effect.runPromiseExit(
      MathReasoning.produceWork({
        givens: ["x + 1"],
        locale: "en",
        objective: "Simplify",
        persistence: "none",
        request: "simplify x + 1",
      }).pipe(
        Effect.provide(MathReasoning.Default),
        Effect.provideService(CasEngine, failingCasEngine()),
        Effect.provide(NoopMathWorkRepository),
        Effect.withConfigProvider(config)
      )
    );

    expect(exitFailure(inputExit)).toBeInstanceOf(MathReasoningInputError);
    expect(exitFailure(casExit)).toBeInstanceOf(MathCasAdapterError);
  });

  it("supports primary-only results through the no-op repository", async () => {
    const exit = await Effect.runPromiseExit(
      MathReasoning.produceWork({
        givens: ["x"],
        locale: "en",
        objective: "Simplify",
        persistence: "persist",
        request: "simplify x",
      }).pipe(
        Effect.provide(MathReasoning.Default),
        Effect.provideService(CasEngine, fakeCasEngine(primaryOnlyResult())),
        Effect.provide(NoopMathWorkRepository),
        Effect.withConfigProvider(config)
      )
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      return;
    }

    expect(exit.value.work.primaryResult.expression).toBe("x");
    expect(exit.value.work.computations[0]?.secondary).toBeUndefined();
    expect(exit.value.work.verification.reasonKey).toBe(
      "math-verification-contradicted"
    );
  });
});

/** Provides a deterministic CAS service for MathReasoning tests. */
function fakeCasEngine(result: MathResult) {
  return CasEngine.make({
    capabilities: Effect.succeed([
      "algebra",
      "equation",
      "calculus",
      "coordinate-geometry",
    ]),
    compute: (_request: MathRequest) => Effect.succeed(result),
  });
}

/** Provides a deterministic CAS service that fails for adapter mapping tests. */
function failingCasEngine() {
  return CasEngine.make({
    capabilities: Effect.succeed([]),
    compute: (_request: MathRequest) =>
      Effect.fail(new MathCasRequestError({ message: "CAS unavailable" })),
  });
}

/** Builds a verified equation-solving CAS result fixture. */
function solveResult(): MathResult {
  return {
    conditions: [],
    input: {
      expression: "x^2 - 1 = 0",
      kind: "math",
      operation: "solve",
      variables: ["x"],
    },
    items: [],
    kind: "solve",
    operation: "solve",
    primary: {
      expression: "x^2 - 1 = 0",
      latex: "x^2 - 1 = 0",
    },
    reason: "The equation operation was checked exactly.",
    secondary: {
      expression: "[-1, 1]",
      latex: "\\left[-1,1\\right]",
    },
    stepStatus: "partial",
    steps: [
      {
        action: "solve",
        items: [],
        primary: {
          expression: "x^2 - 1 = 0",
          latex: "x^2 - 1 = 0",
        },
        relation: {
          expression: "equals",
          latex: "=",
        },
        secondary: {
          expression: "[-1, 1]",
          latex: "\\left[-1,1\\right]",
        },
      },
    ],
    status: "verified",
  };
}

/** Builds an inconclusive coordinate-line CAS result fixture. */
function lineResult(): MathResult {
  return {
    ...solveResult(),
    input: {
      kind: "math",
      operation: "line",
      points: [
        { x: "0", y: "0" },
        { x: "3", y: "2" },
      ],
    },
    kind: "line",
    operation: "line",
    primary: {
      expression: "(0, 0), (3, 2)",
      latex: "(0,0),(3,2)",
    },
    reason: "The line could not be fully verified.",
    secondary: {
      expression: "2*x - 3*y",
      latex: "2x - 3y",
    },
    stepStatus: "unavailable",
    steps: [],
    status: "inconclusive",
  };
}

/** Builds a verified CAS result without a secondary expression. */
function primaryOnlyResult(): MathResult {
  const result = solveResult();
  return {
    ...result,
    input: {
      expression: "x",
      kind: "math",
      operation: "simplify",
    },
    kind: "simplify",
    operation: "simplify",
    primary: {
      expression: "x",
      latex: "x",
    },
    secondary: undefined,
    stepStatus: "complete",
    steps: [],
    status: "contradicted",
  };
}

/** Reads the expected failure value from an Effect exit. */
function exitFailure(exit: Exit.Exit<unknown, unknown>) {
  if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
    return exit.cause.error;
  }

  expect.fail("Expected Effect failure exit.");
}
