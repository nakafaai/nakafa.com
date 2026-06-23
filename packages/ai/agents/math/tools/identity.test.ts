import {
  readCoordinateArtifactId,
  readCoordinateProofAnchor,
} from "@repo/ai/agents/math/tools/identity";
import { describe, expect, it } from "vitest";

describe("math tool artifact identity", () => {
  it("normalizes tool call ids for artifact ids and proof anchors", () => {
    expect(readCoordinateArtifactId(" tool  1 ")).toBe(
      "math-tool-1-coordinate"
    );
    expect(readCoordinateProofAnchor(" tool  1 ")).toBe("math:tool-1");
  });

  it("uses a stable fallback for blank tool call ids", () => {
    expect(readCoordinateArtifactId("   ")).toBe("math-tool-call-coordinate");
    expect(readCoordinateProofAnchor("   ")).toBe("math:tool-call");
  });
});
