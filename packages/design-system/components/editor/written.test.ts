// @vitest-environment jsdom

import { describe, expect, it } from "@effect/vitest";
import { answerOptions } from "@repo/design-system/components/editor/written";
import { NO_MATH_VIEWS } from "@repo/editor/math";
import { Editor, type NodeViewRenderer } from "@tiptap/core";
import { Array as Arr } from "effect";

/** The editor of a written answer that opens on `markdown`, with no page to draw in. */
function openAnswer(markdown: string) {
  return new Editor({
    ...answerOptions({
      formulaViews: NO_MATH_VIEWS,
      limit: 20_000,
      onRefuse: vi.fn<() => void>(),
      placeholder: "",
      taskView: vi.fn<NodeViewRenderer>(),
    }),
    content: markdown,
    contentType: "markdown",
    element: null,
  });
}

/** An essay with a formula in its line, a formula on a line of its own, and words around them. */
const ESSAY = Arr.join(
  [
    "Luas lingkaran adalah $$\\pi r^2$$, jadi untuk **r = 2**:",
    "```math\nL = \\pi \\cdot 2^2 = 4\\pi\n```",
    "- Langkah terakhir",
  ],
  "\n\n"
);

describe("answerOptions", () => {
  it("opens an essay with its formulas as formula nodes, and saves the Markdown it opened", () => {
    const editor = openAnswer(ESSAY);
    const nodes = editor.getJSON().content ?? [];

    expect(nodes[0]?.content?.[1]).toMatchObject({
      attrs: { latex: "\\pi r^2" },
      type: "mathInline",
    });
    expect(nodes[1]).toMatchObject({
      attrs: { latex: "L = \\pi \\cdot 2^2 = 4\\pi" },
      type: "mathBlock",
    });
    expect(editor.getMarkdown()).toBe(ESSAY);
  });

  it("writes a formula the learner inserts as the Markdown the page's reader draws", () => {
    const editor = openAnswer("Jawab:");
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.toggleFormula("mathInline");

    expect(editor.getMarkdown()).toBe("Jawab:$$x$$");
  });
});
