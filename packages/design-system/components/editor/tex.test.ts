// @vitest-environment jsdom

import { describe, expect, it } from "@effect/vitest";
import {
  formulaAt,
  markdownFormulas,
} from "@repo/design-system/components/editor/tex";
import { NO_MATH_VIEWS } from "@repo/editor/math";
import { Editor } from "@tiptap/core";
import { Markdown } from "@tiptap/markdown";
import { StarterKit } from "@tiptap/starter-kit";
import { Option } from "effect";

/** An editor that keeps Markdown with the formulas of learner text, and draws nothing. */
function openEditor(markdown: string) {
  return new Editor({
    content: markdown,
    contentType: "markdown",
    element: null,
    extensions: [StarterKit, ...markdownFormulas(NO_MATH_VIEWS), Markdown],
  });
}

describe("the formulas of learner text in Markdown", () => {
  it("reads a formula of a line and a formula on its own lines, as the page's reader does", () => {
    expect(formulaAt("mathInline", "$$x^2$$ lagi")).toEqual(
      Option.some({ latex: "x^2", raw: "$$x^2$$" })
    );
    expect(formulaAt("mathBlock", "$$\n\\frac{a}{b}\n$$\nsesudah")).toEqual(
      Option.some({ latex: "\\frac{a}{b}", raw: "$$\n\\frac{a}{b}\n$$\n" })
    );
  });

  it("leaves a price, a pair with spaces inside, and a lone pair as words", () => {
    expect(formulaAt("mathInline", "$$5 saja")).toEqual(Option.none());
    expect(formulaAt("mathInline", "$$ x $$")).toEqual(Option.none());
    expect(formulaAt("mathInline", "$$$$")).toEqual(Option.none());
    expect(formulaAt("mathBlock", "$$\n\n$$")).toEqual(Option.none());
  });

  it("keeps a price in a line as words when the editor opens it", () => {
    const editor = openEditor("Harga $$5 saja.");

    expect(editor.getJSON().content).toEqual([
      {
        content: [{ text: "Harga $$5 saja.", type: "text" }],
        type: "paragraph",
      },
    ]);
    editor.destroy();
  });

  it("opens Markdown formulas as formula nodes and writes them back unchanged", () => {
    const editor = openEditor(
      "Luas $$\\pi r^2$$ cm.\n\n$$\nE = mc^2\n$$\n\nSelesai."
    );

    expect(editor.getJSON().content).toEqual([
      {
        content: [
          { text: "Luas ", type: "text" },
          { attrs: { latex: "\\pi r^2" }, type: "mathInline" },
          { text: " cm.", type: "text" },
        ],
        type: "paragraph",
      },
      { attrs: { latex: "E = mc^2" }, type: "mathBlock" },
      { content: [{ text: "Selesai.", type: "text" }], type: "paragraph" },
    ]);
    expect(editor.getMarkdown()).toBe(
      "Luas $$\\pi r^2$$ cm.\n\n$$\nE = mc^2\n$$\n\nSelesai."
    );
    editor.destroy();
  });
});
