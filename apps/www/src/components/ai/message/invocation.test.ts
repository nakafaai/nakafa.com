import { describe, expect, it } from "@effect/vitest";
import type { CapabilityArtifact } from "@repo/backend/confect/nina/capability/progress";
import { LearningCapabilityNameSchema } from "@repo/backend/confect/nina/capability/spec";
import de from "@repo/internationalization/dictionaries/de.json" with {
  type: "json",
};
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import id from "@repo/internationalization/dictionaries/id.json" with {
  type: "json",
};
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import { Array as Arr } from "effect";
import { readInvocation } from "@/components/ai/message/invocation";

const DIGIT = /\d/u;

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
const loadedArtifact = {
  data: { queries: ["limit"], sources: [], status: "done" },
  id: "loaded",
  type: "data-web-search",
} satisfies CapabilityArtifact;

const settled = (
  output: unknown,
  type: ToolUIPart["type"] = "tool-math"
): ToolUIPart => ({
  input: { task: input.expression },
  output,
  state: "output-available",
  toolCallId: "call-1",
  type,
});

describe("readInvocation", () => {
  it("reads a settled capability result with its evidence", () => {
    const invocation = readInvocation(
      settled(
        { artifacts: [loadedArtifact, loadingArtifact], text: "Two sources." },
        "tool-deepResearch"
      ),
      true
    );

    expect(invocation).toEqual({
      artifacts: [loadedArtifact, loadingArtifact],
      capability: "deepResearch",
      state: "done",
    });
  });

  it.each([
    ["with prose", "I could not find a lesson about it."],
    ["without prose", ""],
  ])(
    "reads a stored result with no card and no outcome as empty, %s, as the runner stores a fresh one",
    (_name, text) => {
      expect(
        readInvocation(settled({ artifacts: [], text }), true)
      ).toMatchObject({ artifacts: [], capability: "math", state: "empty" });
    }
  );

  it("reads a stored result that lost its only card and states no outcome as failed, as the runner settles a fresh one", () => {
    expect(
      readInvocation(
        settled({ artifacts: [failedArtifact, loadingArtifact], text: "∞" }),
        true
      )
    ).toMatchObject({ state: "failed" });
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

  it("reads the memory capability as one row that opens to nothing, found or not", () => {
    const found: ToolUIPart = {
      input: { query: "my exam date" },
      output: { artifacts: [], text: "Saved memories matched this query." },
      state: "output-available",
      toolCallId: "call-3",
      type: "tool-memory",
    };
    expect(readInvocation(found, true)).toEqual({
      artifacts: [],
      capability: "memory",
      state: "done",
    });
    expect(
      readInvocation(
        { ...found, output: { artifacts: [], outcome: "empty", text: "None" } },
        true
      )
    ).toEqual({ artifacts: [], capability: "memory", state: "empty" });
    const running: ToolUIPart = {
      input: { query: "my exam date" },
      state: "input-available",
      toolCallId: "call-3",
      type: "tool-memory",
    };
    expect(readInvocation(running, false)).toMatchObject({
      capability: "memory",
      state: "running",
    });
  });

  it.each([
    ["English", en],
    ["Indonesian", id],
    ["German", de],
  ])(
    "labels every capability the row can name, and its failure, in %s",
    (_language, dictionary) => {
      for (const capability of Arr.append(
        LearningCapabilityNameSchema.literals,
        "unknown"
      )) {
        expect(dictionary.Ai.activity).toHaveProperty(capability);
        expect(dictionary.Ai["tool-failures"]).toHaveProperty(capability);
      }
      // One label for the row, with no count and no number in it.
      expect(dictionary.Ai.activity.memory).not.toMatch(DIGIT);
    }
  );

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
});
