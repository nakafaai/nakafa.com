import {
  readInvalidInputRecovery,
  readMathFailureRecovery,
  readMissingCoordinateArtifactDisplayRecovery,
} from "@repo/ai/agents/math/tools/recovery";
import { describe, expect, it } from "vitest";

describe("math recovery policy", () => {
  it("guides ambiguous symbolic checks toward an explicit variable", () => {
    const recovery = readMathFailureRecovery(
      "Variable is required when multiple symbols are present."
    );

    expect(recovery).toContain(
      "Retry the same operation with the explicit variable"
    );
  });

  it("keeps unavailable evidence recovery model-facing and retryable", () => {
    const recovery = readMathFailureRecovery("offline");

    expect(recovery).toContain("Do not present this result as checked.");
    expect(recovery).toContain(
      "Compare this failed input with the original task before answering"
    );
  });

  it("explains how to retry bounded system decode failures", () => {
    const recovery = readInvalidInputRecovery("Expected bounded system solves");

    expect(recovery).toContain("Retry the same equation solve");
    expect(recovery).toContain("Keep the same expressions");
    expect(recovery).toContain("Set variable to the bounded variable");
  });

  it("explains how to retry incomplete bounded system expressions", () => {
    const recovery = readInvalidInputRecovery(
      "Expected every bounded-system expression"
    );

    expect(recovery).toContain("Retry the same bounded system solve");
    expect(recovery).toContain("Keep symbolic parameters out of variables");
    expect(recovery).toContain(
      "Every expression must involve at least one selected unknown"
    );
  });

  it("keeps generic invalid input recovery locale-neutral", () => {
    expect(readInvalidInputRecovery("Expected expression")).toBe(
      "Ask the user for the exact missing expression or data in their language."
    );
  });

  it("asks coordinate artifact calls to retry with display copy", () => {
    const recovery = readMissingCoordinateArtifactDisplayRecovery();

    expect(recovery).toContain("display.title");
    expect(recovery).toContain("display.description");
    expect(recovery).toContain("same operation and point inputs");
  });
});
