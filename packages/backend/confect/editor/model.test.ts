import { describe, expect, it } from "@effect/vitest";
import { assessmentModel } from "@repo/backend/confect/editor/model";
import { MarkTypeSchema } from "@repo/backend/confect/editor/node";
import { nodeDepth } from "@repo/utilities/depth";
import { Record } from "effect";

describe("editor/model content rules", () => {
  it("accepts a list whose items open with a paragraph, and refuses an item that holds none", () => {
    const list = (items: unknown[]) =>
      assessmentModel.nodeFromJSON({
        content: [{ content: items, type: "bulletList" }],
        type: "doc",
      });
    const item = {
      content: [
        { content: [{ text: "satu", type: "text" }], type: "paragraph" },
      ],
      type: "listItem",
    };
    expect(() => list([item]).check()).not.toThrow();
    expect(() => list([{ content: [], type: "listItem" }]).check()).toThrow();
  });

  it("refuses a mark on the text of a code block, which the editor's schema refuses too", () => {
    const code = (marks: unknown[]) =>
      assessmentModel.nodeFromJSON({
        content: [
          {
            content: [{ marks, text: "x", type: "text" }],
            type: "codeBlock",
          },
        ],
        type: "doc",
      });
    expect(() => code([]).check()).not.toThrow();
    expect(() => code([{ type: "bold" }]).check()).toThrow();
  });
});

describe("editor/model marks", () => {
  it("keeps the marks in the contract's order, which ranks them in a text", () => {
    expect(Record.keys(assessmentModel.marks)).toEqual(MarkTypeSchema.literals);
  });
});

describe("editor/model depth", () => {
  it("counts a text node as one level, its paragraph as two, and the document holding it as three", () => {
    const paragraph = assessmentModel.nodeFromJSON({
      content: [
        { content: [{ text: "Soal", type: "text" }], type: "paragraph" },
      ],
      type: "doc",
    });
    expect(nodeDepth(paragraph)).toBe(3);
    expect(nodeDepth(assessmentModel.nodeFromJSON({ type: "doc" }))).toBe(1);
  });
});
