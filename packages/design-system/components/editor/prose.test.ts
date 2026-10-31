// @vitest-environment jsdom

import { describe, expect, it } from "@effect/vitest";
import {
  ARTICLE_MARKS,
  articleProse,
  drawArticleProse,
  drawDocument,
} from "@repo/design-system/components/editor/prose";
import { emphasisVariants } from "@repo/design-system/lib/markdown/emphasis";
import {
  blockGapVariants,
  codeVariants,
  headingTextVariants,
  headingVariants,
  linkVariants,
  listItemVariants,
  listVariants,
  mathBlockVariants,
  mathInlineVariants,
  mathScrollVariants,
  paragraphVariants,
  quoteVariants,
  scriptVariants,
  tableCellVariants,
  tableFrameVariants,
  tableHeadCellVariants,
  tableRowVariants,
} from "@repo/design-system/lib/prose";
import { documentExtensions } from "@repo/editor/document";
import { NO_MATH_VIEWS } from "@repo/editor/math";
import { Editor } from "@tiptap/core";
import { cn } from "cn";
import { Array as Arr } from "effect";

/**
 * A document with each block an article draws: a heading, a paragraph with code, a bold phrase, a link and
 * a sub- and a superscript, lists, a quotation, a code block, a formula, a picture and a table with a header row.
 */
const DOCUMENT =
  '<h2>Judul</h2><p>Hitung <code>x</code> saja, <strong>penting</strong> <a href="https://nakafa.com">tautan</a> H<sub>2</sub>O x<sup>2</sup></p><ul><li><p>satu</p></li></ul><ol><li><p>dua</p></li></ol><blockquote><p>kutipan</p></blockquote><pre><code>a = 1</code></pre><div data-type="math-block" data-latex="a+b"></div><div data-type="image"></div><table><tbody><tr><th><p>kepala</p></th></tr><tr><td><p>sel</p></td></tr></tbody></table>';

/**
 * An editor of the assessment document, mounted on a detached element so the drawn DOM is readable,
 * with the article's classes and, when `paragraphs` is set, its paragraphs' classes too.
 */
function openEditor(paragraphs: boolean) {
  const editor = new Editor({
    content: DOCUMENT,
    element: document.createElement("div"),
    extensions: [
      ...documentExtensions(
        {
          headingLevels: [1, 2, 3],
          isLinkAllowed: () => true,
          marks: ["bold", "code", "link", "subscript", "superscript"],
        },
        { ...NO_MATH_VIEWS, image: null, marks: ARTICLE_MARKS }
      ),
      articleProse.configure({ paragraphs }),
    ],
  });
  return editor;
}

/** The tag and the classes of each element of `root` that the selector finds. */
function classesOf(root: Element, selector: string) {
  return Arr.map(
    Arr.fromIterable(root.querySelectorAll(selector)),
    (element) => [element.tagName, element.className]
  );
}

describe("articleProse", () => {
  it("draws each block with the published article's classes", () => {
    const editor = openEditor(true);
    const root = editor.view.dom;

    expect(classesOf(root, "h2")).toEqual([
      [
        "H2",
        cn(headingVariants({ tag: "h2" }), headingTextVariants({ tag: "h2" })),
      ],
    ]);
    expect(classesOf(root, "ul, ol, li, blockquote")).toEqual([
      ["UL", listVariants({ kind: "bullet" })],
      ["LI", listItemVariants()],
      ["OL", listVariants({ kind: "ordered" })],
      ["LI", listItemVariants()],
      ["BLOCKQUOTE", quoteVariants()],
    ]);
    expect(classesOf(root, "pre")).toEqual([["PRE", blockGapVariants()]]);
    expect(
      classesOf(
        root,
        '[data-type="math-block"], [data-type="image"], .tableWrapper'
      )
    ).toEqual([
      ["DIV", blockGapVariants()],
      ["DIV", blockGapVariants()],
      ["DIV", `tableWrapper ${tableFrameVariants()}`],
    ]);
    expect(classesOf(root, "tr, th, td")).toEqual([
      ["TR", tableRowVariants()],
      ["TH", tableHeadCellVariants()],
      ["TR", tableRowVariants()],
      ["TD", tableCellVariants()],
    ]);
    // A cell's paragraph reads as the cell's words, as the lesson's cell holds them.
    expect(Arr.map(classesOf(root, "p"), ([, classes]) => classes)).toEqual([
      ...Arr.replicate(paragraphVariants(), 4),
      "",
      "",
    ]);
    editor.destroy();
  });

  it("draws each mark on its own element with the published article's classes", () => {
    const editor = openEditor(true);

    expect(classesOf(editor.view.dom, "p > :not(br)")).toEqual([
      ["CODE", codeVariants()],
      ["STRONG", emphasisVariants()],
      ["A", linkVariants()],
      ["SUB", scriptVariants()],
      ["SUP", scriptVariants()],
    ]);
    editor.destroy();
  });

  it("leaves the paragraphs of an option's line plain", () => {
    const editor = openEditor(false);

    expect(
      Arr.map(classesOf(editor.view.dom, "p"), ([, classes]) => classes)
    ).toEqual(Arr.replicate("", 6));
    editor.destroy();
  });

  it("gives a heading of a level the document does not hold no classes", () => {
    const editor = openEditor(true);
    editor.commands.setContent("<p>x</p>");
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(0, editor.schema.nodes.heading, {
        level: 7,
      })
    );

    expect(classesOf(editor.view.dom, "h1")).toEqual([["H1", ""]]);
    editor.destroy();
  });
});

describe("drawArticleProse", () => {
  it("gives the elements of a document drawn without an editor the classes the editor gives them", () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<h1>a</h1><h3>b</h3><p>Hitung <code>x</code> <strong>i</strong> <a href="https://nakafa.com">j</a> <sub>k</sub><sup>l</sup></p><ul><li>c</li></ul><ol><li>d</li></ol><blockquote>e</blockquote><pre><code>f</code></pre><table><tbody><tr><th>g</th></tr><tr><td>h</td></tr></tbody></table><div data-type="image"></div>';
    drawArticleProse(root);
    // A second drawing keeps the table in the one frame it has.
    drawArticleProse(root);

    expect(classesOf(root, "h1, h3")).toEqual([
      [
        "H1",
        cn(headingVariants({ tag: "h1" }), headingTextVariants({ tag: "h1" })),
      ],
      [
        "H3",
        cn(headingVariants({ tag: "h3" }), headingTextVariants({ tag: "h3" })),
      ],
    ]);
    expect(classesOf(root, "code")).toEqual([
      ["CODE", codeVariants()],
      ["CODE", ""],
    ]);
    expect(classesOf(root, "strong, a, sub, sup")).toEqual([
      ["STRONG", emphasisVariants()],
      ["A", linkVariants()],
      ["SUB", scriptVariants()],
      ["SUP", scriptVariants()],
    ]);
    expect(classesOf(root, "ul, ol, li, blockquote, p")).toEqual([
      ["P", ""],
      ["UL", listVariants({ kind: "bullet" })],
      ["LI", listItemVariants()],
      ["OL", listVariants({ kind: "ordered" })],
      ["LI", listItemVariants()],
      ["BLOCKQUOTE", quoteVariants()],
    ]);
    expect(classesOf(root, 'pre, [data-type="image"]')).toEqual([
      ["PRE", blockGapVariants()],
      ["DIV", blockGapVariants()],
    ]);
    expect(classesOf(root, '[data-slot="table-frame"]')).toEqual([
      ["DIV", tableFrameVariants()],
    ]);
    expect(root.querySelector("table")?.parentElement?.dataset.slot).toBe(
      "table-frame"
    );
    expect(classesOf(root, "tr, th, td")).toEqual([
      ["TR", tableRowVariants()],
      ["TH", tableHeadCellVariants()],
      ["TR", tableRowVariants()],
      ["TD", tableCellVariants()],
    ]);
  });
  it("draws the formulas that the schema leaves empty as the lesson draws them, inline and in a card", () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<p>Luas <span data-type="math-inline" data-latex="x^2"></span></p><div data-type="math-block" data-latex="\\frac{1}{2}"></div><span data-type="math-inline"></span><div data-type="math-block"></div>';
    drawArticleProse(root);

    const [inline, empty] = Array.from(
      root.querySelectorAll<HTMLElement>('[data-type="math-inline"]')
    );
    expect(inline?.className).toBe(mathInlineVariants());
    expect(inline?.querySelector(".katex")).not.toBeNull();
    expect(empty?.querySelector(".katex")).not.toBeNull();

    const [block, blank] = Array.from(
      root.querySelectorAll<HTMLElement>('[data-type="math-block"]')
    );
    expect(blank?.querySelector(".katex-display")).not.toBeNull();
    expect(block?.className).toBe(blockGapVariants());
    const card = block?.firstElementChild;
    expect(card?.className).toBe(mathBlockVariants());
    expect(card?.firstElementChild?.className).toBe(mathScrollVariants());
    expect(card?.querySelector(".katex-display")).not.toBeNull();
  });
});

describe("drawDocument", () => {
  /** The document of an editor, drawn into a new element without it. */
  const drawn = (content: string, paragraphs: boolean) => {
    const editor = openEditor(paragraphs);
    editor.commands.setContent(content);
    const root = document.createElement("div");
    drawDocument(root, editor.state.doc, paragraphs);
    return root;
  };

  it("draws a prompt with the article's paragraphs, each block in the direction of its words", () => {
    const root = drawn(
      "<p>Soal</p><table><tbody><tr><td><p>sel</p></td></tr></tbody></table>",
      true
    );
    const [paragraph, cell] = root.querySelectorAll("p");

    expect(paragraph?.className).toBe(paragraphVariants());
    expect(paragraph?.getAttribute("dir")).toBe("auto");
    expect(cell?.className).toBe("");
  });

  it("leaves an option's paragraph as a line, and gives an empty paragraph its height", () => {
    const line = drawn("<p>Pilihan</p>", false).querySelector("p");
    const empty = drawn("<p></p>", false).querySelector("p");

    expect(line?.className).toBe("");
    expect(empty?.querySelector("br")).not.toBeNull();
  });
});
