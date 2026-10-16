// @vitest-environment jsdom

import { describe, expect, it } from "@effect/vitest";
import { stepSizeGuard } from "@repo/design-system/components/editor/size";
import { Editor } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";
import { StarterKit } from "@tiptap/starter-kit";

/**
 * The bound of the test editor, in bytes. A run of 300 letters is one step of more
 * than 300 bytes, so it is over the bound, and a letter is well within it.
 */
const MAX_BYTES = 200;

/** A headless editor that refuses a step over `MAX_BYTES`, and a state of its document. */
function openEditor() {
  const editor = new Editor({
    element: null,
    extensions: [StarterKit, stepSizeGuard(MAX_BYTES)],
  });
  const stateOf = (doc: ReturnType<typeof editor.schema.node>) =>
    EditorState.create({ doc, plugins: editor.extensionManager.plugins });
  return { editor, schema: editor.schema, stateOf };
}

describe("stepSizeGuard", () => {
  it("refuses an edit whose step is over the bound, and keeps the document", () => {
    const { schema, stateOf } = openEditor();
    const state = stateOf(
      schema.node("doc", null, [
        schema.node("paragraph", null, [schema.text("a")]),
      ])
    );
    const pasted = state.tr.insertText("x".repeat(300), 1);
    const next = state.apply(pasted);
    expect(next).toBe(state);
    expect(next.doc.textContent).toBe("a");
  });

  it("applies an edit whose step is within the bound", () => {
    const { schema, stateOf } = openEditor();
    const state = stateOf(
      schema.node("doc", null, [
        schema.node("paragraph", null, [schema.text("a")]),
      ])
    );
    const next = state.apply(state.tr.insertText("b", 1));
    expect(next.doc.textContent).toBe("ba");
  });

  it("applies a change another editor's steps brought in, though its step is over the bound", () => {
    const { schema, stateOf } = openEditor();
    const state = stateOf(
      schema.node("doc", null, [
        schema.node("paragraph", null, [schema.text("a")]),
      ])
    );
    const received = state.tr
      .insertText("x".repeat(300), 1)
      .setMeta("rebased", 0);
    const next = state.apply(received);
    expect(next.doc.textContent).toBe(`${"x".repeat(300)}a`);
  });
});
