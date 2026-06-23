import {
  decodeLearningArtifact,
  LearningArtifactDecodeError,
  MAX_COORDINATE_ARTIFACT_BYTES,
  MAX_COORDINATE_ARTIFACT_PRIMITIVES,
} from "@repo/math/schema/artifact";
import { MAX_POLYGON_VERTICES } from "@repo/math/schema/coordinate-primitives";
import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";

describe("LearningArtifact invariants", () => {
  it("rejects nonnumeric axis bounds with a typed error", async () => {
    const artifact = createArtifact({
      axes: {
        x: [scalar("left"), scalar("1")],
        y: [scalar("-1"), scalar("1")],
        z: [scalar("-1"), scalar("1")],
      },
    });

    const failure = await decodeFailure(artifact);

    expect(failure).toBeInstanceOf(LearningArtifactDecodeError);
    if (failure instanceof LearningArtifactDecodeError) {
      expect(failure.message).toBe(
        "Coordinate artifact x-axis range must use sortable numeric bounds."
      );
    }
  });

  it("rejects nonnumeric axis upper bounds with a typed error", async () => {
    const artifact = createArtifact({
      axes: {
        x: [scalar("-1"), scalar("1")],
        y: [scalar("-1"), scalar("top")],
        z: [scalar("-1"), scalar("1")],
      },
    });

    const failure = await decodeFailure(artifact);

    expect(failure).toBeInstanceOf(LearningArtifactDecodeError);
    if (failure instanceof LearningArtifactDecodeError) {
      expect(failure.message).toBe(
        "Coordinate artifact y-axis range must use sortable numeric bounds."
      );
    }
  });

  it("rejects decreasing axis bounds with a typed error", async () => {
    const artifact = createArtifact({
      axes: {
        x: [scalar("-1"), scalar("1")],
        y: [scalar("2"), scalar("1")],
        z: [scalar("-1"), scalar("1")],
      },
    });

    const failure = await decodeFailure(artifact);

    expect(failure).toBeInstanceOf(LearningArtifactDecodeError);
    if (failure instanceof LearningArtifactDecodeError) {
      expect(failure.message).toBe(
        "Coordinate artifact y-axis range must be increasing."
      );
    }
  });

  it("accepts decimal-backed numeric axis bounds", async () => {
    const artifact = createArtifact({
      axes: {
        x: [scalarDecimal("-1", -1), scalarDecimal("1", 1)],
        y: [scalarDecimal("-2", -2), scalarDecimal("2", 2)],
        z: [scalarDecimal("-3", -3), scalarDecimal("3", 3)],
      },
    });

    const decoded = await Effect.runPromise(decodeLearningArtifact(artifact));

    expect(decoded.payload.axes.z[1].decimal).toBe(3);
  });

  it("rejects coordinate primitive invariant failures with a typed error", async () => {
    const artifact = createArtifact({
      primitives: [
        {
          direction: point("0", "0", "0"),
          id: "ray-zero",
          kind: "ray",
          origin: point("0", "0", "0"),
        },
      ],
    });

    const failure = await decodeFailure(artifact);

    expect(failure).toBeInstanceOf(LearningArtifactDecodeError);
    if (failure instanceof LearningArtifactDecodeError) {
      expect(failure.message).toBe(
        "Coordinate primitive ray-zero has a zero direction vector."
      );
    }
  });

  it("rejects oversized artifact payloads with a typed error", async () => {
    const artifact = createArtifact({
      description: "x".repeat(MAX_COORDINATE_ARTIFACT_BYTES + 1),
    });

    const failure = await decodeFailure(artifact);

    expect(failure).toBeInstanceOf(LearningArtifactDecodeError);
    if (failure instanceof LearningArtifactDecodeError) {
      expect(failure.message).toBe(
        `Coordinate artifact exceeds ${MAX_COORDINATE_ARTIFACT_BYTES} bytes.`
      );
    }
  });

  it("rejects primitive counts above the schema budget", async () => {
    const artifact = createArtifact({
      primitives: Array.from(
        { length: MAX_COORDINATE_ARTIFACT_PRIMITIVES + 1 },
        (_, index) => ({
          id: `point-${index}`,
          kind: "point",
          point: point(String(index), "0", "0"),
        })
      ),
    });

    const failure = await decodeFailure(artifact);

    expect(failure).toBeInstanceOf(LearningArtifactDecodeError);
    if (failure instanceof LearningArtifactDecodeError) {
      expect(failure.message).toBe("Invalid learning artifact contract.");
    }
  });

  it("rejects polygon vertex counts above the geometry budget", async () => {
    const artifact = createArtifact({
      primitives: [
        {
          id: "dense-polygon",
          kind: "polygon",
          vertices: Array.from({ length: MAX_POLYGON_VERTICES + 1 }, (_, x) =>
            point(String(x), "0", "0")
          ),
        },
      ],
    });

    const failure = await decodeFailure(artifact);

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
    description?: string;
    primitives?: readonly unknown[];
  } = {}
) {
  return {
    description: input.description,
    id: "artifact-invariant",
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
    proofAnchors: ["cas://coordinate/artifact"],
    title: "Coordinate artifact",
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
