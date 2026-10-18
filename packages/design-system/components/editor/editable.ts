import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";

/**
 * Tells assistive technology and the browser tests whether the editing surface takes
 * input. The editor always carries the `textbox` role, so without `aria-readonly` a
 * surface that is still read-only, such as a synced document that has not opened yet,
 * reads as a textbox that accepts typing and loses every key pressed into it. The
 * attribute follows the editor's own `editable` option each time the view updates,
 * which `setEditable` does.
 */
export const editableState = Extension.create({
  name: "editableState",
  addProseMirrorPlugins() {
    const { editor } = this;
    return [
      new Plugin({
        props: {
          attributes: () => ({
            "aria-readonly": editor.options.editable ? "false" : "true",
          }),
        },
      }),
    ];
  },
});
