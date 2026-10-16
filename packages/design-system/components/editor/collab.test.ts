// @vitest-environment jsdom

import { describe, expect, it } from "@effect/vitest";
import { Collab } from "@repo/design-system/components/editor/collab";
import { Editor } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";
import { StarterKit } from "@tiptap/starter-kit";
import { getVersion, sendableSteps } from "prosemirror-collab";

/** A headless editor with the collab plugin at a version, under a client ID. */
function openEditor(clientId: string, version: number) {
  return new Editor({
    element: null,
    extensions: [StarterKit, Collab.configure({ clientId, version })],
  });
}

/** A state of the editor's document with the editor's plugins, as the editor builds its own. */
function stateOf(editor: Editor) {
  return EditorState.create({
    doc: editor.state.doc,
    plugins: editor.extensionManager.plugins,
  });
}

describe("Collab", () => {
  it("starts at the version and under the client ID it is given, with nothing to send", () => {
    const editor = openEditor("rina", 40);
    const state = stateOf(editor);

    expect(getVersion(state)).toBe(40);
    expect(sendableSteps(state)).toBeNull();
    editor.destroy();
  });

  it("keeps each local edit as a step to send, under the client ID and on the version the editor holds", () => {
    const editor = openEditor("rina", 40);
    const state = stateOf(editor);
    const edited = state.apply(state.tr.insertText("a", 1));

    expect(sendableSteps(edited)).toMatchObject({
      clientID: "rina",
      version: 40,
    });
    expect(sendableSteps(edited)?.steps).toHaveLength(1);
    editor.destroy();
  });
});
