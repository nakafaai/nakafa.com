// @vitest-environment jsdom

import { describe, expect, it } from "@effect/vitest";
import {
  blockDirections,
  markBlockDirections,
} from "@repo/design-system/components/editor/direction";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Array as Arr } from "effect";

/** The tag and the direction of each element of the selector, in the order the page draws them. */
function directionsOf(root: ParentNode, selector: string) {
  return Arr.map(
    Arr.fromIterable(root.querySelectorAll(selector)),
    (element) => [element.tagName, element.getAttribute("dir")] as const
  );
}

describe("blockDirections", () => {
  it("gives each block that reads its own text a direction of auto, and leaves a paragraph of a list item to its item", () => {
    const editor = new Editor({
      element: document.createElement("div"),
      extensions: [StarterKit, blockDirections],
    });
    editor.commands.setContent(
      "<p>one</p><h2>title</h2><ul><li><p>item</p></li></ul>"
    );

    // The last paragraph is the empty one that StarterKit's trailing node keeps after a list.
    expect(directionsOf(editor.view.dom, "p, h2, li")).toEqual([
      ["P", "auto"],
      ["H2", "auto"],
      ["LI", "auto"],
      ["P", null],
      ["P", "auto"],
    ]);
    editor.destroy();
  });

  it("changes no node, so the stored document holds no direction", () => {
    const editor = new Editor({
      element: document.createElement("div"),
      extensions: [StarterKit, blockDirections],
    });
    editor.commands.setContent("<p>مرحبا</p>");

    expect(JSON.stringify(editor.getJSON())).not.toContain("dir");
    editor.destroy();
  });
});

describe("markBlockDirections", () => {
  it("sets a direction of auto on each block of a drawn document, except a paragraph of a list item", () => {
    const root = document.createElement("div");
    root.innerHTML =
      "<h1>a</h1><p>top</p><ul><li><p>item</p></li></ul><table><tbody><tr><td>cell</td><th>head</th></tr></tbody></table><pre>code</pre>";

    markBlockDirections(root);

    expect(directionsOf(root, "[dir]")).toEqual([
      ["H1", "auto"],
      ["P", "auto"],
      ["LI", "auto"],
      ["TD", "auto"],
      ["TH", "auto"],
    ]);
    expect(root.querySelector("li p")?.getAttribute("dir")).toBeNull();
    expect(root.querySelector("pre")?.getAttribute("dir")).toBeNull();
  });
});
