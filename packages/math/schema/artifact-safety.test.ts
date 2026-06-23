import {
  decodeLearningArtifact,
  LearningArtifactDecodeError,
  MAX_COORDINATE_ARTIFACT_PROOF_ANCHOR_LENGTH,
  MAX_COORDINATE_ARTIFACT_PROOF_ANCHORS,
  MAX_LEARNING_ARTIFACT_ID_LENGTH,
} from "@repo/math/schema/artifact";
import {
  MAX_COORDINATE_PRIMITIVE_ID_LENGTH,
  MAX_FUNCTION_DOMAINS,
  MAX_FUNCTION_EXCLUSIONS,
} from "@repo/math/schema/coordinate-primitives";
import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";

describe("LearningArtifact safety budgets", () => {
  it("rejects scalar function exclusion counts above budget", async () => {
    const artifact = createArtifact({
      primitives: [
        {
          function: functionSpec({
            exclusions: Array.from(
              { length: MAX_FUNCTION_EXCLUSIONS + 1 },
              (_, index) => literalAst(String(index))
            ),
          }),
          id: "dense-exclusions",
          kind: "function-surface",
          outputAxis: "z",
        },
      ],
    });

    const failure = await decodeFailure(artifact);

    expect(failure).toBeInstanceOf(LearningArtifactDecodeError);
    if (failure instanceof LearningArtifactDecodeError) {
      expect(failure.message).toBe("Invalid learning artifact contract.");
    }
  });

  it("rejects scalar function domain counts above budget", async () => {
    const artifact = createArtifact({
      primitives: [
        {
          function: functionSpec({
            domains: Array.from(
              { length: MAX_FUNCTION_DOMAINS + 1 },
              (_, index) => domainByIndex(index)
            ),
          }),
          id: "dense-scalar-domains",
          kind: "function-surface",
          outputAxis: "z",
        },
      ],
    });

    const failure = await decodeFailure(artifact);

    expect(failure).toBeInstanceOf(LearningArtifactDecodeError);
    if (failure instanceof LearningArtifactDecodeError) {
      expect(failure.message).toBe("Invalid learning artifact contract.");
    }
  });

  it("rejects vector function domain counts above budget", async () => {
    const artifact = createArtifact({
      primitives: [
        {
          function: {
            domain: Array.from(
              { length: MAX_FUNCTION_DOMAINS + 1 },
              (_, index) => domainByIndex(index)
            ),
            x: variableAst("x"),
            y: literalAst("0"),
            z: literalAst("1"),
          },
          id: "dense-vector-domains",
          kind: "parametric-surface",
        },
      ],
    });

    const failure = await decodeFailure(artifact);

    expect(failure).toBeInstanceOf(LearningArtifactDecodeError);
    if (failure instanceof LearningArtifactDecodeError) {
      expect(failure.message).toBe("Invalid learning artifact contract.");
    }
  });

  it("rejects non-finite decimal hints before artifact persistence", async () => {
    const decimals = [Number.POSITIVE_INFINITY, Number.NaN];

    for (const decimal of decimals) {
      const failure = await decodeFailure(
        createArtifact({
          axes: {
            x: [scalarDecimal("1", decimal), scalar("2")],
            y: [scalar("-1"), scalar("1")],
            z: [scalar("-1"), scalar("1")],
          },
        })
      );

      expect(failure).toBeInstanceOf(LearningArtifactDecodeError);
      if (failure instanceof LearningArtifactDecodeError) {
        expect(failure.message).toBe("Invalid learning artifact contract.");
      }
    }
  });

  it("rejects proof anchor lists above artifact budgets", async () => {
    const failure = await decodeFailure(
      createArtifact({
        proofAnchors: Array.from(
          { length: MAX_COORDINATE_ARTIFACT_PROOF_ANCHORS + 1 },
          (_, index) => `cas://coordinate/proof-${index}`
        ),
      })
    );

    expect(failure).toBeInstanceOf(LearningArtifactDecodeError);
    if (failure instanceof LearningArtifactDecodeError) {
      expect(failure.message).toBe("Invalid learning artifact contract.");
    }
  });

  it("rejects proof anchors above the per-item budget", async () => {
    const failure = await decodeFailure(
      createArtifact({
        proofAnchors: [
          `cas://coordinate/${"x".repeat(
            MAX_COORDINATE_ARTIFACT_PROOF_ANCHOR_LENGTH
          )}`,
        ],
      })
    );

    expect(failure).toBeInstanceOf(LearningArtifactDecodeError);
    if (failure instanceof LearningArtifactDecodeError) {
      expect(failure.message).toBe("Invalid learning artifact contract.");
    }
  });

  it("rejects blank artifact identifiers", async () => {
    const failure = await decodeFailure(createArtifact({ id: "   " }));

    expect(failure).toBeInstanceOf(LearningArtifactDecodeError);
    if (failure instanceof LearningArtifactDecodeError) {
      expect(failure.message).toBe("Invalid learning artifact contract.");
    }
  });

  it("rejects artifact identifiers above the id budget", async () => {
    const failure = await decodeFailure(
      createArtifact({
        id: `artifact-${"x".repeat(MAX_LEARNING_ARTIFACT_ID_LENGTH)}`,
      })
    );

    expect(failure).toBeInstanceOf(LearningArtifactDecodeError);
    if (failure instanceof LearningArtifactDecodeError) {
      expect(failure.message).toBe("Invalid learning artifact contract.");
    }
  });

  it("rejects blank coordinate primitive identifiers", async () => {
    const failure = await decodeFailure(
      createArtifact({
        primitives: [
          {
            id: "   ",
            kind: "point",
            point: point("0", "0", "0"),
          },
        ],
      })
    );

    expect(failure).toBeInstanceOf(LearningArtifactDecodeError);
    if (failure instanceof LearningArtifactDecodeError) {
      expect(failure.message).toBe("Invalid learning artifact contract.");
    }
  });

  it("rejects coordinate primitive identifiers above the id budget", async () => {
    const failure = await decodeFailure(
      createArtifact({
        primitives: [
          {
            id: `primitive-${"x".repeat(MAX_COORDINATE_PRIMITIVE_ID_LENGTH)}`,
            kind: "point",
            point: point("0", "0", "0"),
          },
        ],
      })
    );

    expect(failure).toBeInstanceOf(LearningArtifactDecodeError);
    if (failure instanceof LearningArtifactDecodeError) {
      expect(failure.message).toBe("Invalid learning artifact contract.");
    }
  });
});

function createArtifact(
  input: {
    axes?: {
      x: readonly [ReturnType<typeof scalar>, ReturnType<typeof scalar>];
      y: readonly [ReturnType<typeof scalar>, ReturnType<typeof scalar>];
      z: readonly [ReturnType<typeof scalar>, ReturnType<typeof scalar>];
    };
    id?: string;
    primitives?: readonly unknown[];
    proofAnchors?: readonly string[];
  } = {}
) {
  return {
    id: input.id ?? "artifact-safety",
    kind: "coordinate-system-3d",
    payload: {
      axes: input.axes ?? {
        x: [scalar("-1"), scalar("1")],
        y: [scalar("-1"), scalar("1")],
        z: [scalar("-1"), scalar("1")],
      },
      primitives: input.primitives ?? [
        {
          id: "point-1",
          kind: "point",
          point: point("0", "0", "0"),
        },
      ],
      sampling: {
        curveSamples: 16,
        surfaceCells: 16,
      },
    },
    proofAnchors: input.proofAnchors ?? ["cas://coordinate/artifact"],
    title: "Coordinate artifact",
  };
}

function functionSpec(
  input: {
    domains?: readonly ReturnType<typeof domainByIndex>[];
    exclusions?: readonly unknown[];
  } = {}
) {
  return {
    ast: variableAst("x"),
    domain: input.domains ?? [domain("x"), domain("y")],
    exclusions: input.exclusions,
  };
}

function domain(variable: "x" | "y" | "z" | "t") {
  return {
    closedMax: true,
    closedMin: true,
    max: scalar("1"),
    min: scalar("0"),
    variable,
  };
}

function domainByIndex(index: number) {
  const variables = ["x", "y", "z", "t"] as const;
  return domain(variables[index % variables.length]);
}

function variableAst(variable: "x" | "y" | "z") {
  return {
    canonical: variable,
    latex: variable,
    nodes: [{ id: variable, kind: "variable", name: variable }],
    root: variable,
  };
}

function literalAst(expression: string) {
  const nodeId = `literal-${expression}`;

  return {
    canonical: expression,
    latex: expression,
    nodes: [
      {
        id: nodeId,
        kind: "literal",
        value: scalar(expression),
      },
    ],
    root: nodeId,
  };
}

function point(x: string, y: string, z: string) {
  return {
    x: scalar(x),
    y: scalar(y),
    z: scalar(z),
  };
}

function scalar(expression: string) {
  return {
    expression,
    latex: expression,
  };
}

function scalarDecimal(expression: string, decimal: number) {
  return {
    decimal,
    expression,
    latex: expression,
  };
}

async function decodeFailure(input: unknown) {
  const exit = await Effect.runPromiseExit(decodeLearningArtifact(input));
  if (Exit.isSuccess(exit)) {
    return;
  }

  const failure = Cause.failureOption(exit.cause);
  return Option.isSome(failure) ? failure.value : undefined;
}
