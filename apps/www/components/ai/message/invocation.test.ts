import { describe, expect, it } from "@effect/vitest";
import type { CapabilityArtifact } from "@repo/backend/confect/nina/capability/progress";
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import { Array as Arr } from "effect";
import { isProblem, readInvocation } from "@/components/ai/message/invocation";

const input = {
  expression: "1 / 0",
  kind: "math",
  operation: "evaluate",
} as const;
const failedArtifact = {
  data: {
    error: "Division by zero.",
    input,
    kind: "evaluate",
    status: "error",
  },
  id: "failed",
  type: "data-math",
} satisfies CapabilityArtifact;
const loadingArtifact = {
  data: { input, kind: "evaluate", status: "loading" },
  id: "loading",
  type: "data-math",
} satisfies CapabilityArtifact;

const settled = (output: unknown): ToolUIPart => ({
  input: { task: input.expression },
  output,
  state: "output-available",
  toolCallId: "call-1",
  type: "tool-math",
});

describe("readInvocation", () => {
  it("reads a settled capability result and counts failed evidence", () => {
    const invocation = readInvocation(
      settled({ artifacts: [failedArtifact, loadingArtifact], text: "∞" }),
      true
    );

    expect(invocation).toEqual({
      artifacts: [failedArtifact, loadingArtifact],
      capability: "math",
      failures: 1,
      state: "done",
    });
  });

  it("keeps unfinished work running until its turn settles", () => {
    const pending: ToolUIPart = {
      input: { task: input.expression },
      state: "input-available",
      toolCallId: "call-1",
      type: "tool-math",
    };
    const preliminary: ToolUIPart = {
      input: { task: input.expression },
      output: { artifacts: [loadingArtifact], text: "" },
      preliminary: true,
      state: "output-available",
      toolCallId: "call-1",
      type: "tool-math",
    };

    expect(readInvocation(pending, false)).toMatchObject({ state: "running" });
    expect(readInvocation(pending, true)).toMatchObject({ state: "stopped" });
    expect(
      readInvocation(
        { state: "input-streaming", toolCallId: "call-1", type: "tool-math" },
        false
      )
    ).toMatchObject({ artifacts: [], state: "running" });
    expect(readInvocation(preliminary, true)).toMatchObject({
      artifacts: [loadingArtifact],
      state: "stopped",
    });
  });

  it.each(["partial", "empty", "limit", "denied", "failed"] as const)(
    "takes the stored %s outcome as the state, whatever evidence sits beside it",
    (outcome) => {
      expect(
        readInvocation(
          settled({ artifacts: [failedArtifact], outcome, text: "" }),
          true
        )
      ).toMatchObject({ artifacts: [failedArtifact], state: outcome });
    }
  );

  it("fails on tool errors and on outputs that break the contract", () => {
    const errored: ToolUIPart = {
      errorText: "Provider failed.",
      input: undefined,
      state: "output-error",
      toolCallId: "call-1",
      type: "tool-math",
    };

    expect(readInvocation(errored, true)).toMatchObject({ state: "failed" });
    expect(readInvocation(settled({ text: 19 }), true)).toMatchObject({
      artifacts: [],
      state: "failed",
    });
    expect(
      readInvocation(
        settled({ artifacts: [], outcome: "later", text: "" }),
        true
      )
    ).toMatchObject({ state: "failed" });
  });

  it("marks denials and names capabilities Nina does not own as unknown", () => {
    const denied: DynamicToolUIPart = {
      approval: { approved: false, id: "approval-1" },
      input: {},
      state: "output-denied",
      toolCallId: "call-2",
      toolName: "weather",
      type: "dynamic-tool",
    };

    expect(readInvocation(denied, true)).toMatchObject({
      capability: "unknown",
      state: "denied",
    });
  });

  it("reads only denied, failed and limit as a problem", () => {
    const states = [
      "denied",
      "done",
      "empty",
      "failed",
      "limit",
      "partial",
      "running",
      "stopped",
    ] as const;
    expect(Arr.filter(states, isProblem)).toEqual([
      "denied",
      "failed",
      "limit",
    ]);
  });
});
