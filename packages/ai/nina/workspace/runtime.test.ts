import { capabilityResult } from "@repo/ai/nina/capability/result";
import {
  EvidenceEnvelope,
  LearningCapabilityResult,
} from "@repo/ai/nina/capability/spec";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createNinaWorkspaceRuntime } from "./runtime";

describe("nina/workspace/runtime", () => {
  it("appends capability results to the turn-local workspace", async () => {
    const workspace = await Effect.runPromise(
      Effect.gen(function* () {
        const runtime = yield* createNinaWorkspaceRuntime({
          turnId: "turn-runtime-append",
        });

        yield* runtime.appendResult(
          capabilityResult({
            capability: "nakafa",
            limitations: ["Current page fetch was skipped."],
            refs: ["lesson:coordinate-system"],
            status: "available",
            text: "Nakafa selected the coordinate-system lesson.",
          })
        );

        return yield* runtime.readWorkspace();
      })
    );

    expect(workspace.contributions).toHaveLength(1);
    expect(workspace.contributions[0]?.capability).toBe("nakafa");
    expect(workspace.contributions[0]?.evidence.refs).toEqual([
      "lesson:coordinate-system",
    ]);
    expect(workspace.contributions[0]?.evidence.limitations).toEqual([
      "Current page fetch was skipped.",
    ]);
  });

  it("projects appended evidence for later model steps", async () => {
    const projection = await Effect.runPromise(
      Effect.gen(function* () {
        const runtime = yield* createNinaWorkspaceRuntime({
          turnId: "turn-runtime-projection",
        });

        yield* runtime.appendResult(
          capabilityResult({
            capability: "math",
            status: "available",
            text: "Math verified slope 2 and y-intercept 1.",
          })
        );

        return yield* runtime.readProjection();
      })
    );

    expect(projection).toContain("Capability: math");
    expect(projection).toContain("Math verified slope 2 and y-intercept 1.");
  });

  it("uses text or status fallback when capability summaries are blank", async () => {
    const projection = await Effect.runPromise(
      Effect.gen(function* () {
        const runtime = yield* createNinaWorkspaceRuntime({
          turnId: "turn-runtime-summary",
        });

        yield* runtime.appendResult(
          LearningCapabilityResult.make({
            evidence: EvidenceEnvelope.make({
              capability: "deepResearch",
              status: "limited",
              summary: " ",
            }),
            text: "Use only official sources already cited.",
          })
        );
        yield* runtime.appendResult(
          LearningCapabilityResult.make({
            evidence: EvidenceEnvelope.make({
              capability: "math",
              status: "failed",
              summary: " ",
            }),
            text: " ",
          })
        );

        return yield* runtime.readProjection();
      })
    );

    expect(projection).toContain("Use only official sources already cited.");
    expect(projection).toContain("math returned failed evidence.");
  });
});
