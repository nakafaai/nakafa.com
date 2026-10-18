// @vitest-environment jsdom

import { describe, expect, it } from "@effect/vitest";
import { articleParagraphs } from "@repo/design-system/components/editor/paragraph";
import { paragraphVariants } from "@repo/design-system/lib/paragraph";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Array as Arr } from "effect";

/**
 * An editor mounted on a detached element, whose document is two paragraphs with a heading
 * between them. A view exists only once the editor is mounted, so the drawn DOM is readable.
 */
function openEditor() {
  const editor = new Editor({
    element: document.createElement("div"),
    extensions: [StarterKit, articleParagraphs],
  });
  editor.commands.setContent("<p>one</p><h2>title</h2><p>two</p>");
  return editor;
}

describe("articleParagraphs", () => {
  it("draws each paragraph with the classes of the published article's paragraphs, and no other block", () => {
    const editor = openEditor();

    const blocks = Arr.fromIterable(editor.view.dom.querySelectorAll("p, h2"));

    expect(
      Arr.map(blocks, (block) => [block.tagName, block.className])
    ).toEqual([
      ["P", paragraphVariants()],
      ["H2", ""],
      ["P", paragraphVariants()],
    ]);
    editor.destroy();
  });
});
