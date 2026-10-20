import { describe, expect, it } from "@effect/vitest";
import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import { Array as Arr } from "effect";
import { groupMessageParts } from "@/components/ai/message/group";

type Part = NinaMessage["parts"][number];

const step: Part = { type: "step-start" };
const reasoning: Part = { state: "done", text: "Plan.", type: "reasoning" };
const research: Part = {
  input: { question: "Why is the derivative of x squared 2x?" },
  output: { artifacts: [], text: "Found one source." },
  state: "output-available",
  toolCallId: "call-research",
  type: "tool-deepResearch",
};
const source = (id: string): Part => ({
  sourceId: id,
  title: "Derivative",
  type: "source-url",
  url: `https://en.wikipedia.org/wiki/${id}`,
});
const text = (value: string): Part => ({
  state: "done",
  text: value,
  type: "text",
});
const file: Part = {
  mediaType: "image/png",
  type: "file",
  url: "https://example.com/graph.png",
};

/** Reduces groups to their kinds, entry keys, and each answer's trailing keys. */
function outline(parts: Part[]) {
  return Arr.map(groupMessageParts(parts), (group) => ({
    entries: Arr.map(group.entries, (entry) =>
      entry.type === "answer"
        ? `${entry.key} > ${Arr.join(
            Arr.map(entry.trailing, ({ key }) => key),
            ", "
          )}`
        : entry.key
    ),
    key: group.key,
    kind: group.kind,
  }));
}

describe("groupMessageParts", () => {
  it("keeps Agent order, skipping step markers and empty text", () => {
    expect(
      outline([step, reasoning, research, step, text("  "), text("Answer.")])
    ).toEqual([
      {
        entries: ["reasoning-0", "call-research"],
        key: "reasoning-0",
        kind: "activity",
      },
      { entries: ["text-0 > "], key: "text-0", kind: "response" },
    ]);
  });

  it("keeps the parts after an answer with it until the next answer", () => {
    expect(
      outline([
        file,
        text("First."),
        source("Derivative"),
        source("Limit"),
        text("Second."),
        file,
      ])
    ).toEqual([
      {
        entries: [
          "file-0",
          "text-0 > source-url-0, source-url-1",
          "text-1 > file-1",
        ],
        key: "file-0",
        kind: "response",
      },
    ]);
  });

  it("keys the streamed and saved copies of a message alike", () => {
    expect(
      outline([step, reasoning, research, step, text("Answer."), source("A")])
    ).toEqual(outline([reasoning, research, text("Answer."), source("A")]));
  });

  it("never holds parts behind work steps", () => {
    expect(outline([text("Answer."), reasoning, source("A")])).toEqual([
      { entries: ["text-0 > "], key: "text-0", kind: "response" },
      { entries: ["reasoning-0"], key: "reasoning-0", kind: "activity" },
      { entries: ["source-url-0"], key: "source-url-0", kind: "response" },
    ]);
  });
});
