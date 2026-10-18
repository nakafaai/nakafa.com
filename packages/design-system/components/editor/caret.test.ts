// @vitest-environment jsdom

import { describe, expect, it } from "@effect/vitest";
import { placeCaret } from "@repo/design-system/components/editor/caret";

/** A new editor that records every caret placement it is asked for. */
function newEditor() {
  const focus = vi.fn<(position: "end") => boolean>(() => true);

  return { editor: { commands: { focus } }, focus };
}

describe("caret", () => {
  it("puts the caret at the end of a new editor when no field has the focus", () => {
    const { editor, focus } = newEditor();
    const button = document.createElement("button");

    placeCaret(editor, null);
    placeCaret(editor, button);
    placeCaret(editor, document.body);

    expect(focus).toHaveBeenCalledTimes(3);
    expect(focus).toHaveBeenCalledWith("end");
  });

  it("leaves the caret alone while the learner types in a field of their own", () => {
    const { editor, focus } = newEditor();
    const title = document.createElement("input");
    const select = document.createElement("select");
    const area = document.createElement("textarea");
    const words = document.createElement("div");
    words.setAttribute("contenteditable", "true");

    placeCaret(editor, title);
    placeCaret(editor, select);
    placeCaret(editor, area);
    placeCaret(editor, words);

    expect(focus).not.toHaveBeenCalled();
  });
});
