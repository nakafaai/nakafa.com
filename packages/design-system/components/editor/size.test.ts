// @vitest-environment jsdom

import { describe, expect, it } from "@effect/vitest";
import {
  documentSizeGuard,
  stepSizeGuard,
} from "@repo/design-system/components/editor/size";
import { Editor } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";
import { StarterKit } from "@tiptap/starter-kit";

/**
 * The bound of the test editor, in bytes. A run of 300 letters is one step of more
 * than 300 bytes, so it is over the bound, and a letter is well within it.
 */
const MAX_BYTES = 200;

/**
 * A headless editor that holds the guard it is given, with its schema and a builder of
 * states of its documents. The states carry the editor's plugins, so a transaction applied
 * to them is filtered.
 */
function openEditor(guard: ReturnType<typeof stepSizeGuard>) {
  const editor = new Editor({
    element: null,
    extensions: [StarterKit, guard],
  });
  const stateOf = (doc: ReturnType<typeof editor.schema.node>) =>
    EditorState.create({ doc, plugins: editor.extensionManager.plugins });
  return { schema: editor.schema, stateOf };
}

describe("stepSizeGuard", () => {
  it("refuses an edit whose step is over the bound, and keeps the document", () => {
    const { schema, stateOf } = openEditor(stepSizeGuard(MAX_BYTES));
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
    const { schema, stateOf } = openEditor(stepSizeGuard(MAX_BYTES));
    const state = stateOf(
      schema.node("doc", null, [
        schema.node("paragraph", null, [schema.text("a")]),
      ])
    );
    const next = state.apply(state.tr.insertText("b", 1));
    expect(next.doc.textContent).toBe("ba");
  });

  it("applies a change another editor's steps brought in, though its step is over the bound", () => {
    const { schema, stateOf } = openEditor(stepSizeGuard(MAX_BYTES));
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

describe("documentSizeGuard", () => {
  it("refuses an edit that grows the document past the bound, and keeps the document", () => {
    const { schema, stateOf } = openEditor(documentSizeGuard(MAX_BYTES));
    const state = stateOf(
      schema.node("doc", null, [
        schema.node("paragraph", null, [schema.text("a")]),
      ])
    );
    const next = state.apply(state.tr.insertText("x".repeat(300), 1));
    expect(next).toBe(state);
    expect(next.doc.textContent).toBe("a");
  });

  it("applies an edit that keeps the document within the bound", () => {
    const { schema, stateOf } = openEditor(documentSizeGuard(MAX_BYTES));
    const state = stateOf(
      schema.node("doc", null, [
        schema.node("paragraph", null, [schema.text("a")]),
      ])
    );
    const next = state.apply(state.tr.insertText("b", 1));
    expect(next.doc.textContent).toBe("ba");
  });

  it("applies an edit that only removes content from a document past the bound", () => {
    const { schema, stateOf } = openEditor(documentSizeGuard(MAX_BYTES));
    const state = stateOf(
      schema.node("doc", null, [
        schema.node("paragraph", null, [schema.text("x".repeat(300))]),
      ])
    );
    const next = state.apply(state.tr.delete(1, 11));
    expect(next.doc.textContent).toBe("x".repeat(290));
  });

  it("refuses an edit that grows a document already past the bound", () => {
    const { schema, stateOf } = openEditor(documentSizeGuard(MAX_BYTES));
    const state = stateOf(
      schema.node("doc", null, [
        schema.node("paragraph", null, [schema.text("x".repeat(300))]),
      ])
    );
    const next = state.apply(state.tr.insertText("b", 1));
    expect(next).toBe(state);
  });

  it("applies an edit that only removes a mark from a document past the bound", () => {
    const { schema, stateOf } = openEditor(documentSizeGuard(MAX_BYTES));
    const bold = schema.marks.bold.create();
    const state = stateOf(
      schema.node("doc", null, [
        schema.node("paragraph", null, [schema.text("x".repeat(300), [bold])]),
      ])
    );
    const next = state.apply(state.tr.removeMark(1, 301, bold));
    expect(next).not.toBe(state);
    expect(next.doc.textContent).toBe("x".repeat(300));
  });

  it("refuses a mark removal that splits a text node and grows the document past the bound", () => {
    const { schema, stateOf } = openEditor(documentSizeGuard(MAX_BYTES));
    const bold = schema.marks.bold.create();
    const state = stateOf(
      schema.node("doc", null, [
        schema.node("paragraph", null, [schema.text("x".repeat(300), [bold])]),
      ])
    );
    const next = state.apply(state.tr.removeMark(101, 201, bold));
    expect(next).toBe(state);
  });

  it("refuses an edit that adds a mark past the bound, and keeps the document", () => {
    const { schema, stateOf } = openEditor(documentSizeGuard(MAX_BYTES));
    const state = stateOf(
      schema.node("doc", null, [
        schema.node("paragraph", null, [schema.text("x".repeat(300))]),
      ])
    );
    const next = state.apply(
      state.tr.addMark(1, 301, schema.marks.bold.create())
    );
    expect(next).toBe(state);
  });

  it("applies a change another editor's steps brought in, though it grows the document past the bound", () => {
    const { schema, stateOf } = openEditor(documentSizeGuard(MAX_BYTES));
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
