// @vitest-environment node

import {
  CapabilityTrace,
  EvidenceEnvelope,
  encodeCapabilityTrace,
} from "@repo/ai/nina/capability/spec";
import { describe, expect, it } from "vitest";

describe("nina/capability/spec", () => {
  it("encodes schema class traces into plain operational values", () => {
    const trace = CapabilityTrace.make({
      capability: "math",
      durationMs: 12,
      endedAt: 1_772_007_212,
      evidence: EvidenceEnvelope.make({
        capability: "math",
        refs: ["nakafa://content/math"],
        status: "available",
        summary: "2 + 3 = 5",
      }),
      responseMessageIdentifier: "response-1",
      startedAt: 1_772_007_200,
      toolCallId: "tool-1",
    });

    const encoded = encodeCapabilityTrace(trace);

    expect(encoded).toEqual({
      capability: "math",
      durationMs: 12,
      endedAt: 1_772_007_212,
      evidence: {
        capability: "math",
        refs: ["nakafa://content/math"],
        status: "available",
        summary: "2 + 3 = 5",
      },
      responseMessageIdentifier: "response-1",
      startedAt: 1_772_007_200,
      toolCallId: "tool-1",
    });
    expect(Object.getPrototypeOf(encoded)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(encoded.evidence)).toBe(Object.prototype);
  });
});
