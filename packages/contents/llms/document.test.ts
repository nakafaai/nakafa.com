import { describe, expect, it } from "@effect/vitest";
import {
  type AssessmentDocument,
  AssessmentDocumentSchema,
} from "@nakafa/aksara-contracts/assessment/document";
import { documentMarkdown } from "@repo/contents/llms/document";
import { Schema } from "effect";

/** Decodes a document the way the contract stores it, so every fixture is a valid document. */
const doc = (content: readonly unknown[]): AssessmentDocument =>
  Schema.decodeSync(AssessmentDocumentSchema)({ content, type: "doc" });

/** A cell that spans one column and one row. */
const SPAN = { colspan: 1, rowspan: 1 };

/** One uploaded image's asset. */
const ASSET = "asset-1";

const paragraph = (...content: readonly unknown[]) => ({
  content,
  type: "paragraph",
});
const text = (value: string, marks?: readonly unknown[]) =>
  marks === undefined
    ? { text: value, type: "text" }
    : { marks, text: value, type: "text" };

describe("contents/llms/document", () => {
  it("writes headings, paragraphs, every mark, links, inline math, line breaks, and answer fields", () => {
    expect(
      documentMarkdown(
        doc([
          { attrs: { level: 2 }, content: [text("Soal")], type: "heading" },
          paragraph(
            text("Hitung "),
            text("luas", [{ type: "bold" }]),
            text(" "),
            text("segitiga", [{ type: "italic" }]),
            text(" "),
            text("x", [{ type: "code" }]),
            text(" "),
            text("dengan", [{ type: "underline" }]),
            text(" "),
            text("2", [{ type: "subscript" }]),
            text(" "),
            text("3", [{ type: "superscript" }]),
            text(" "),
            text("rumus", [
              { attrs: { href: "/id/subjects/math" }, type: "link" },
            ]),
            { type: "hardBreak" },
            { attrs: { latex: "a^2" }, type: "mathInline" },
            text(" = "),
            {
              attrs: { gap: null, interaction: "entry" },
              type: "inlineInteraction",
            }
          ),
        ])
      )
    ).toBe(
      "## Soal\n\nHitung **luas** _segitiga_ `x` dengan 2 3 [rumus](/id/subjects/math)\n$a^2$ = [blank]"
    );
  });

  it("writes an empty paragraph as an empty line", () => {
    expect(
      documentMarkdown(doc([{ type: "paragraph" }, paragraph(text("akhir"))]))
    ).toBe("\n\nakhir");
  });

  it("writes code, block math, images, figures, and block interactions", () => {
    expect(
      documentMarkdown(
        doc([
          {
            attrs: { language: "ts" },
            content: [text("const a = 1;")],
            type: "codeBlock",
          },
          { attrs: { language: null }, type: "codeBlock" },
          { attrs: { latex: "\\frac{1}{2}" }, type: "mathBlock" },
          {
            attrs: {
              alt: "Grafik fungsi",
              asset: ASSET,
              height: 100,
              width: 200,
            },
            type: "image",
          },
          {
            attrs: {
              alt: "Diagram alir",
              caption: null,
              component: "Mermaid",
              props: {
                chart: "graph TD; A-->B",
                description: "Dua langkah",
                title: "Alur",
              },
            },
            type: "figure",
          },
          { attrs: { interaction: "choice" }, type: "interaction" },
        ])
      )
    ).toBe(
      "```ts\nconst a = 1;\n```\n\n```\n\n```\n\n$$\n\\frac{1}{2}\n$$\n\n[Image: Grafik fungsi]\n\n[Figure: Diagram alir]\n\n[answer]"
    );
  });

  it("writes bullet and ordered lists with nested blocks indented under their marker", () => {
    expect(
      documentMarkdown(
        doc([
          {
            content: [
              { content: [paragraph(text("satu"))], type: "listItem" },
              {
                content: [
                  paragraph(text("dua")),
                  {
                    attrs: { start: 3 },
                    content: [
                      { content: [paragraph(text("tiga"))], type: "listItem" },
                    ],
                    type: "orderedList",
                  },
                ],
                type: "listItem",
              },
            ],
            type: "bulletList",
          },
        ])
      )
    ).toBe("- satu\n- dua\n  \n  3. tiga");
  });

  it("writes block quotes line by line and tables with a header separator", () => {
    expect(
      documentMarkdown(
        doc([
          {
            content: [paragraph(text("kutipan")), paragraph(text("baris"))],
            type: "blockquote",
          },
          {
            content: [
              {
                content: [
                  {
                    attrs: SPAN,
                    content: [paragraph(text("A"))],
                    type: "tableHeader",
                  },
                  {
                    attrs: SPAN,
                    content: [paragraph(text("B"))],
                    type: "tableHeader",
                  },
                ],
                type: "tableRow",
              },
              {
                content: [
                  {
                    attrs: SPAN,
                    content: [paragraph(text("1"))],
                    type: "tableCell",
                  },
                  {
                    attrs: SPAN,
                    content: [
                      paragraph(text("2"), { type: "hardBreak" }, text("3")),
                    ],
                    type: "tableCell",
                  },
                ],
                type: "tableRow",
              },
            ],
            type: "table",
          },
        ])
      )
    ).toBe("> kutipan\n>\n> baris\n\n| A | B |\n| --- | --- |\n| 1 | 2 3 |");
  });
});
