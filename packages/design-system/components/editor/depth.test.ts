// @vitest-environment jsdom

import { describe, expect, it } from "@effect/vitest";
import {
  depthGuard,
  nodeDepth,
} from "@repo/design-system/components/editor/depth";
import { Editor } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";
import { StarterKit } from "@tiptap/starter-kit";

/** The bound of the test document, small enough that a blockquote breaks it. */
const MAX_DEPTH = 3;

/** A headless editor that refuses edits past `MAX_DEPTH`, and a state of `text` in a paragraph of its schema. */
function openEditor() {
  const editor = new Editor({
    element: null,
    extensions: [StarterKit, depthGuard(MAX_DEPTH)],
  });
  const { blockquote, paragraph } = editor.schema.nodes;
  const stateOf = (doc: ReturnType<typeof editor.schema.node>) =>
    EditorState.create({ doc, plugins: editor.extensionManager.plugins });
  return { blockquote, editor, paragraph, schema: editor.schema, stateOf };
}

describe("nodeDepth", () => {
  it("counts a node and every level below it, text included", () => {
    const { blockquote, paragraph, schema } = openEditor();
    const doc = schema.node("doc", null, [
      blockquote.create(null, paragraph.create(null, schema.text("a"))),
    ]);
    expect(nodeDepth(doc)).toBe(4);
  });
});

describe("depthGuard", () => {
  it("refuses an edit that nests the document past the bound, and keeps the document", () => {
    const { blockquote, paragraph, schema, stateOf } = openEditor();
    const state = stateOf(
      schema.node("doc", null, [paragraph.create(null, schema.text("a"))])
    );
    const deeper = blockquote.create(
      null,
      paragraph.create(null, schema.text("b"))
    );
    const next = state.apply(state.tr.insert(0, deeper));
    expect(next).toBe(state);
    expect(nodeDepth(next.doc)).toBe(MAX_DEPTH);
  });

  it("applies an edit that keeps the document within the bound", () => {
    const { paragraph, schema, stateOf } = openEditor();
    const state = stateOf(
      schema.node("doc", null, [paragraph.create(null, schema.text("a"))])
    );
    const next = state.apply(state.tr.insertText("b", 1));
    expect(next.doc.textContent).toBe("ba");
  });

  it("applies an edit that does not nest a document already past the bound any deeper", () => {
    const { blockquote, paragraph, schema, stateOf } = openEditor();
    const state = stateOf(
      schema.node("doc", null, [
        blockquote.create(null, paragraph.create(null, schema.text("a"))),
      ])
    );
    // Position 2 is the start of the text, inside the blockquote and the paragraph.
    const next = state.apply(state.tr.insertText("b", 2));
    expect(next.doc.textContent).toBe("ba");
    expect(nodeDepth(next.doc)).toBe(4);
  });

  it("applies a change another editor's steps brought in, though it nests the document past the bound", () => {
    const { blockquote, paragraph, schema, stateOf } = openEditor();
    const state = stateOf(
      schema.node("doc", null, [paragraph.create(null, schema.text("a"))])
    );
    const deeper = blockquote.create(
      null,
      paragraph.create(null, schema.text("b"))
    );
    const next = state.apply(state.tr.insert(0, deeper).setMeta("rebased", 1));
    expect(nodeDepth(next.doc)).toBe(4);
  });
});
