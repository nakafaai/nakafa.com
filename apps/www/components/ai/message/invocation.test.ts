import { describe, expect, it } from "@effect/vitest";
import type { CapabilityArtifact } from "@repo/backend/confect/nina/capability/progress";
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import { readInvocation } from "@/components/ai/message/invocation";

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
      denied: false,
      failed: false,
      failures: 1,
      running: false,
      sourceLimit: undefined,
      stopped: false,
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

    expect(readInvocation(pending, false)).toMatchObject({
      running: true,
      stopped: false,
    });
    expect(readInvocation(pending, true)).toMatchObject({
      running: false,
      stopped: true,
    });
    expect(
      readInvocation(
        { state: "input-streaming", toolCallId: "call-1", type: "tool-math" },
        false
      )
    ).toMatchObject({ artifacts: [], running: true });
    expect(readInvocation(preliminary, true)).toMatchObject({
      artifacts: [loadingArtifact],
      stopped: true,
    });
  });

  it("fails on tool errors, typed failures and outputs that break the contract", () => {
    const errored: ToolUIPart = {
      errorText: "Provider failed.",
      input: undefined,
      state: "output-error",
      toolCallId: "call-1",
      type: "tool-math",
    };

    expect(readInvocation(errored, true)).toMatchObject({ failed: true });
    expect(
      readInvocation(
        settled({ artifacts: [], failure: "failed", text: "" }),
        true
      )
    ).toMatchObject({ failed: true, sourceLimit: undefined });
    expect(
      readInvocation(
        settled({ artifacts: [], failure: "sourceLimit", text: "" }),
        true
      )
    ).toMatchObject({ failed: true, sourceLimit: 8 });
    expect(readInvocation(settled({ text: 19 }), true)).toMatchObject({
      artifacts: [],
      failed: true,
    });
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
      denied: true,
      failed: false,
    });
    expect(
      readInvocation(
        settled({ artifacts: [], failure: "denied", text: "" }),
        true
      )
    ).toMatchObject({ capability: "math", denied: true });
  });
});
