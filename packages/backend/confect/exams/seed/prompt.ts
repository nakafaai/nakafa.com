import { Array as Arr } from "effect";

/*
 * The prompts the acceptance seed writes, in the stored form that the editor writes: a prompt of
 * plain paragraphs, and the prose question's prompt that holds every block and mark once.
 */

/** A mark with no attribute, by its name in the stored document. */
const mark = (type: "bold" | "code" | "subscript" | "superscript") => ({
  type,
});

/** A link to the address, as the stored document holds it. */
const linkMark = (href: string) => ({ attrs: { href }, type: "link" });

/** A run of text, with its marks when it has any, in the stored form that the editor writes. */
const textNode = (
  text: string,
  marks?: readonly (ReturnType<typeof linkMark> | ReturnType<typeof mark>)[]
) => ({
  ...(marks === undefined ? {} : { marks }),
  text,
  type: "text",
});

/** One paragraph of a prompt, in the stored form that the editor writes. */
const paragraphNode = (text: string) => ({
  content: [textNode(text)],
  type: "paragraph",
});

/** A prompt of paragraphs with their text, in the stored form that the editor writes. */
export const paragraphsDocument = (
  paragraphs: Arr.NonEmptyReadonlyArray<string>
) => ({
  content: Arr.map(paragraphs, paragraphNode),
  type: "doc",
});

/** One cell of a table, a header's or a body's, that holds one paragraph. */
const cellNode = (type: "tableCell" | "tableHeader", text: string) => ({
  attrs: { colspan: 1, rowspan: 1 },
  content: [paragraphNode(text)],
  type,
});

/** One item of a list, which holds one paragraph. */
const itemNode = (text: string) => ({
  content: [paragraphNode(text)],
  type: "listItem",
});

/**
 * The prompt of the prose question: every block and mark an exam document holds, once each, so a
 * browser test compares each one with the lesson's (e2e/school/prose.browser.ts): a heading, a
 * paragraph with a bold phrase, a link, inline code, a subscript, a superscript and an inline
 * formula, both lists, a quotation, a table with a header row, and a formula on its own line.
 */
export const PROSE_PROMPT = {
  content: [
    {
      attrs: { level: 2 },
      content: [textNode("Soal ketiga")],
      type: "heading",
    },
    {
      content: [
        textNode("Bacalah "),
        textNode("kata penting", [mark("bold")]),
        textNode(", buka "),
        textNode("tautan", [linkMark("https://nakafa.com")]),
        textNode(", tulis "),
        textNode("x + 1", [mark("code")]),
        textNode(", lalu H"),
        textNode("2", [mark("subscript")]),
        textNode("O dan x"),
        textNode("2", [mark("superscript")]),
        textNode(" bersama "),
        { attrs: { latex: "a^2 + b^2" }, type: "mathInline" },
        textNode("."),
      ],
      type: "paragraph",
    },
    {
      content: [itemNode("Butir pertama"), itemNode("Butir kedua")],
      type: "bulletList",
    },
    {
      attrs: { start: 1 },
      content: [itemNode("Langkah pertama"), itemNode("Langkah kedua")],
      type: "orderedList",
    },
    { content: [paragraphNode("Kutipan yang dibaca.")], type: "blockquote" },
    {
      content: [
        {
          content: [
            cellNode("tableHeader", "Zat"),
            cellNode("tableHeader", "Titik didih"),
          ],
          type: "tableRow",
        },
        {
          content: [
            cellNode("tableCell", "Air"),
            cellNode("tableCell", "100 °C"),
          ],
          type: "tableRow",
        },
      ],
      type: "table",
    },
    { attrs: { latex: "\\frac{1}{2} m v^2" }, type: "mathBlock" },
  ],
  type: "doc",
};
