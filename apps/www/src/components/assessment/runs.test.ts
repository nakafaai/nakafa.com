import { describe, expect, it } from "@effect/vitest";
import type { InlineNode } from "@nakafa/aksara-contracts/assessment/inline";
import { InlineNodeSchema } from "@nakafa/aksara-contracts/assessment/inline";
import { Schema } from "effect";
import {
  groupInlineNodes,
  InlineRunSchema,
} from "@/components/assessment/runs";

const decodeNodes = (nodes: readonly unknown[]): readonly InlineNode[] =>
  Schema.decodeUnknownSync(Schema.Array(InlineNodeSchema))(nodes);

describe("groupInlineNodes", () => {
  it("groups contiguous text and mathInline sharing the same mark into one continuous run", () => {
    const nodes = decodeNodes([
      { text: "Dari persamaan, ", type: "text" },
      { marks: [{ type: "bold" }], text: "koefisien di depan ", type: "text" },
      {
        attrs: { latex: "x" },
        marks: [{ type: "bold" }],
        type: "mathInline",
      },
      { marks: [{ type: "bold" }], text: " adalah ", type: "text" },
      {
        attrs: { latex: "2" },
        marks: [{ type: "bold" }],
        type: "mathInline",
      },
      { text: ".", type: "text" },
    ]);

    const grouped = groupInlineNodes(nodes);
    expect(grouped).toEqual([
      { kind: "leaf", node: { text: "Dari persamaan, ", type: "text" } },
      {
        children: [
          { kind: "leaf", node: { text: "koefisien di depan ", type: "text" } },
          { kind: "leaf", node: { latex: "x", type: "mathInline" } },
          { kind: "leaf", node: { text: " adalah ", type: "text" } },
          { kind: "leaf", node: { latex: "2", type: "mathInline" } },
        ],
        kind: "mark",
        mark: { type: "bold" },
      },
      { kind: "leaf", node: { text: ".", type: "text" } },
    ]);
    expect(Schema.decodeSync(Schema.Array(InlineRunSchema))(grouped)).toEqual(
      grouped
    );
  });

  it("canonicalizes nested marks regardless of input order and keeps distinct mark variants separate", () => {
    const nodes = decodeNodes([
      {
        marks: [{ attrs: { variant: null }, type: "highlight" }],
        text: "utama ",
        type: "text",
      },
      {
        attrs: { latex: "y" },
        marks: [
          { type: "italic" },
          { attrs: { variant: null }, type: "highlight" },
        ],
        type: "mathInline",
      },
      {
        marks: [{ attrs: { variant: "success" }, type: "highlight" }],
        text: " selesai",
        type: "text",
      },
    ]);

    expect(groupInlineNodes(nodes)).toEqual([
      {
        children: [
          { kind: "leaf", node: { text: "utama ", type: "text" } },
          {
            children: [
              { kind: "leaf", node: { latex: "y", type: "mathInline" } },
            ],
            kind: "mark",
            mark: { type: "italic" },
          },
        ],
        kind: "mark",
        mark: { attrs: { variant: null }, type: "highlight" },
      },
      {
        children: [{ kind: "leaf", node: { text: " selesai", type: "text" } }],
        kind: "mark",
        mark: { attrs: { variant: "success" }, type: "highlight" },
      },
    ]);
  });

  it("handles unmarked mathInline, all mark kinds, hardBreak, inlineInteraction, and empty input", () => {
    expect(groupInlineNodes(undefined)).toEqual([]);

    const nodes = decodeNodes([
      { attrs: { latex: "a+b" }, type: "mathInline" },
      { type: "hardBreak" },
      {
        attrs: { gap: null, interaction: "entry" },
        type: "inlineInteraction",
      },
      {
        marks: [
          { type: "underline" },
          { type: "code" },
          { type: "subscript" },
          { type: "superscript" },
          { attrs: { href: "/id/math" }, type: "link" },
        ],
        text: "all",
        type: "text",
      },
    ]);

    expect(groupInlineNodes(nodes)).toEqual([
      { kind: "leaf", node: { latex: "a+b", type: "mathInline" } },
      { kind: "leaf", node: { type: "hardBreak" } },
      {
        kind: "leaf",
        node: { interaction: "entry", type: "inlineInteraction" },
      },
      {
        children: [
          {
            children: [
              {
                children: [
                  {
                    children: [
                      {
                        children: [
                          { kind: "leaf", node: { text: "all", type: "text" } },
                        ],
                        kind: "mark",
                        mark: { type: "code" },
                      },
                    ],
                    kind: "mark",
                    mark: { type: "superscript" },
                  },
                ],
                kind: "mark",
                mark: { type: "subscript" },
              },
            ],
            kind: "mark",
            mark: { type: "underline" },
          },
        ],
        kind: "mark",
        mark: { attrs: { href: "/id/math" }, type: "link" },
      },
    ]);
  });
});
