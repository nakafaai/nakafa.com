import type { Message, MessageDoc } from "@convex-dev/agent/validators";
import { describe, expect, it } from "@effect/vitest";
import {
  withDerivedReasoning,
  withoutSkeletonReasoning,
} from "@repo/backend/confect/nina/sealed/reasoning";

const ROW = {
  _creationTime: 0,
  _id: "message",
  order: 0,
  status: "success",
  stepOrder: 0,
  threadId: "thread",
  tool: false,
} satisfies MessageDoc;

const SKELETON: Message = {
  content: [
    { text: "", type: "reasoning" },
    { text: "", type: "text" },
    { text: "", type: "reasoning" },
  ],
  role: "assistant",
};

const EMPTY = { text: "", type: "reasoning" } as const;

describe("withDerivedReasoning", () => {
  it("joins the reasoning parts and keeps them as the details", () => {
    const message: Message = {
      content: [
        { text: "Langkah pertama. ", type: "reasoning" },
        { text: "Hasilnya 4.", type: "text" },
        { text: "Periksa lagi.", type: "reasoning" },
      ],
      role: "assistant",
    };
    expect(withDerivedReasoning({ ...ROW, message })).toEqual({
      ...ROW,
      message,
      reasoning: "Langkah pertama. Periksa lagi.",
      reasoningDetails: [
        { text: "Langkah pertama. ", type: "reasoning" },
        { text: "Periksa lagi.", type: "reasoning" },
      ],
    });
  });

  it("leaves out an empty reasoning and keeps its details", () => {
    const message: Message = { content: [EMPTY], role: "assistant" };
    expect(withDerivedReasoning({ ...ROW, message })).toEqual({
      ...ROW,
      message,
      reasoningDetails: [EMPTY],
    });
  });

  it.each([
    { content: "Hasilnya 4.", role: "assistant" },
    { content: [{ text: "Hasilnya 4.", type: "text" }], role: "assistant" },
    { content: "Berapa 2 + 2?", role: "user" },
  ] satisfies Message[])(
    "derives nothing without reasoning parts",
    (message) => {
      expect(withDerivedReasoning({ ...ROW, message })).toEqual({
        ...ROW,
        message,
      });
    }
  );

  it("keeps a row that stores either field or no message as it is", () => {
    const stored = { ...ROW, message: SKELETON, reasoning: "Stored." };
    expect(withDerivedReasoning(stored)).toBe(stored);
    const details = { ...ROW, message: SKELETON, reasoningDetails: [] };
    expect(withDerivedReasoning(details)).toBe(details);
    expect(withDerivedReasoning(ROW)).toBe(ROW);
  });
});

describe("withoutSkeletonReasoning", () => {
  it("drops the empty details that the Agent derives from a skeleton", () => {
    expect(
      withoutSkeletonReasoning(
        { ...ROW, error: "Cut off.", reasoningDetails: [EMPTY, EMPTY] },
        SKELETON
      )
    ).toEqual({ ...ROW, error: "Cut off." });
  });

  // One detail fewer, a detail with text, a text detail, a signed detail, a redacted detail.
  it.each([
    { ...ROW, reasoningDetails: [EMPTY] },
    { ...ROW, reasoningDetails: [EMPTY, { ...EMPTY, text: "x" }] },
    { ...ROW, reasoningDetails: [EMPTY, { text: "", type: "text" }] },
    { ...ROW, reasoningDetails: [EMPTY, { ...EMPTY, signature: "s" }] },
    { ...ROW, reasoningDetails: [EMPTY, { data: "", type: "redacted" }] },
  ] satisfies MessageDoc[])(
    "keeps details the skeleton does not derive (%#)",
    (stored) => {
      expect(withoutSkeletonReasoning(stored, SKELETON)).toBe(stored);
    }
  );

  it("keeps a stored reasoning, no details, and details beside a skeleton without reasoning", () => {
    const reasoned = {
      ...ROW,
      reasoning: "Stored.",
      reasoningDetails: [EMPTY, EMPTY],
    };
    expect(withoutSkeletonReasoning(reasoned, SKELETON)).toBe(reasoned);
    expect(withoutSkeletonReasoning(ROW, SKELETON)).toBe(ROW);
    const empty = { ...ROW, reasoningDetails: [] };
    expect(withoutSkeletonReasoning(empty, SKELETON)).toBe(empty);
    const plain = { ...ROW, reasoningDetails: [EMPTY] };
    expect(
      withoutSkeletonReasoning(plain, { content: "Hi", role: "user" })
    ).toBe(plain);
  });
});
