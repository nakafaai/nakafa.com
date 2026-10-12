import { describe, expect, it } from "@effect/vitest";
import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import { isAnswerWaiting } from "@/components/ai/message/waiting";

type Part = NinaMessage["parts"][number];

const empty: Part = { state: "done", text: "  ", type: "text" };
const text: Part = { state: "done", text: "A limit is a value.", type: "text" };
const reasoning: Part = { state: "done", text: "Plan.", type: "reasoning" };
const research: Part = {
  input: { question: "Why is the derivative of x squared 2x?" },
  output: { artifacts: [], text: "Found one source." },
  state: "output-available",
  toolCallId: "call-research",
  type: "tool-deepResearch",
};

/** One row of the transcript with the fields the loader reads. */
function row(
  role: NinaMessage["role"],
  parts: Part[],
  status: NinaMessage["status"] = "streaming"
): NinaMessage {
  return {
    _creationTime: 1,
    id: `${role}_1`,
    key: `thread_1-1-${role === "user" ? 0 : 1}`,
    order: 1,
    parts,
    role,
    status,
    stepOrder: role === "user" ? 0 : 1,
    text: "",
  };
}

const waiting = {
  last: true,
  message: row("assistant", [{ type: "step-start" }, empty]),
  status: "running",
} as const;

describe("message/waiting", () => {
  it("shows Nina typing in the newest answer of a running turn that has nothing yet", () => {
    expect(isAnswerWaiting(waiting)).toBe(true);
    expect(isAnswerWaiting({ ...waiting, status: "queued" })).toBe(true);
    expect(isAnswerWaiting({ ...waiting, message: row("assistant", []) })).toBe(
      true
    );
  });

  it("stops once the answer has text, reasoning or a tool step to show", () => {
    for (const part of [text, reasoning, research]) {
      expect(
        isAnswerWaiting({ ...waiting, message: row("assistant", [part]) })
      ).toBe(false);
    }
  });

  it("shows one loader: an earlier answer of the same turn stays quiet", () => {
    expect(isAnswerWaiting({ ...waiting, last: false })).toBe(false);
  });

  it("stays quiet once the turn has settled or is not known", () => {
    for (const status of [
      "complete",
      "failed",
      "cancelled",
      "unanswered",
      undefined,
    ] as const) {
      expect(isAnswerWaiting({ ...waiting, status })).toBe(false);
    }
  });

  it("stays quiet in a prompt and in an answer that failed", () => {
    expect(isAnswerWaiting({ ...waiting, message: row("user", [empty]) })).toBe(
      false
    );
    expect(
      isAnswerWaiting({
        ...waiting,
        message: row("assistant", [empty], "failed"),
      })
    ).toBe(false);
  });
});
