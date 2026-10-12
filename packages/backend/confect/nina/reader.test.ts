import type { UIMessage } from "@convex-dev/agent";
import { describe, expect, it } from "@effect/vitest";
import {
  readerMessage,
  readerStreams,
} from "@repo/backend/confect/nina/reader";
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import { Array as Arr, Struct } from "effect";

type Part = UIMessage["parts"][number];

/** A message as Agent lists it, written by an account. */
function message(role: UIMessage["role"], parts: Part[]): UIMessage {
  return {
    _creationTime: 1,
    id: "message-1",
    key: "thread-1-0-0",
    order: 0,
    parts,
    role,
    status: "success",
    stepOrder: 0,
    text: "The value is 2.",
    userId: "user-1",
  };
}

const step: Part = { type: "step-start" };
const words: Part = { text: "The value is 2.", type: "text" };
const math: Part = {
  input: { expression: "1+1" },
  output: { text: "2" },
  state: "output-available",
  toolCallId: "math-1",
  type: "tool-math",
};

const input = { query: "when is my exam" };
const search = { toolCallId: "recall-1", type: "tool-memory" } as const;
const found: ToolUIPart = {
  ...search,
  input,
  output: { artifacts: [], text: "Saved memories matched this query." },
  state: "output-available",
};
/** A search of the owner's memory in each state a part can be in. */
const SEARCHES: ToolUIPart[] = [
  { ...search, input, state: "input-streaming" },
  { ...search, input, state: "input-available" },
  found,
  {
    ...search,
    errorText: "Memory could not be read right now.",
    input,
    state: "output-error",
  },
  {
    ...search,
    approval: { approved: false, id: "approval-1" },
    input,
    state: "output-denied",
  },
];
/** The same call, written as the SDK writes a tool it knows only at run time. */
const dynamic: DynamicToolUIPart = {
  input,
  state: "input-available",
  toolCallId: "recall-2",
  toolName: "memory",
  type: "dynamic-tool",
};

describe("what a reader of a shared chat is told", () => {
  it("is no stream, whichever stream it asks for", () => {
    expect(readerStreams({ kind: "list" })).toEqual({
      kind: "list",
      messages: [],
    });
    expect(
      readerStreams({
        cursors: [{ cursor: 0, streamId: "stream-1" }],
        kind: "deltas",
      })
    ).toEqual({ deltas: [], kind: "deltas" });
  });

  it("names no account in a message, and changes nothing else of one without a search", () => {
    for (const role of ["user", "assistant"] as const) {
      const sent = message(role, [step, math, words]);

      expect(readerMessage(sent)).toEqual(Struct.omit(sent, ["userId"]));
    }
  });

  it.each(Arr.map(SEARCHES, (part) => [part.state, part] as const))(
    "leaves out a search of the owner's memory in the state %s, with the step marker in front of it",
    (_state, part) => {
      expect(
        readerMessage(message("assistant", [step, math, step, part, words]))
          .parts
      ).toEqual([step, math, words]);
    }
  );

  it("leaves out every search of a step, and one that the SDK writes as a dynamic tool, but not another dynamic tool", () => {
    const other: Part = { ...dynamic, toolName: "another" };
    const told = readerMessage(
      message("assistant", [
        ...Arr.flatMap(SEARCHES, (part) => [step, part]),
        step,
        dynamic,
        other,
        words,
      ])
    );

    expect(told.parts).toEqual([other, words]);
  });

  it("keeps the step marker of every other call, and one that nothing follows", () => {
    expect(
      readerMessage(message("assistant", [step, math, step])).parts
    ).toEqual([step, math, step]);
  });

  it("keeps a message that held only a search, with no part", () => {
    expect(readerMessage(message("assistant", [step, found]))).toMatchObject({
      parts: [],
      role: "assistant",
      text: "The value is 2.",
    });
  });
});
