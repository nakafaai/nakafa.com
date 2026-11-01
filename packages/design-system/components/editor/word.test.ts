// @vitest-environment jsdom

import { describe, expect, it } from "@effect/vitest";
import {
  wholeLists,
  wordLists,
  wordPaste,
} from "@repo/design-system/components/editor/word";
import { Editor } from "@tiptap/core";
import { Fragment, Slice } from "@tiptap/pm/model";
import { StarterKit } from "@tiptap/starter-kit";
import { Array as Arr } from "effect";

/** One paragraph of a Word list, as Word writes it for the clipboard, with its marker drawn as text. */
const item = (marker: string, words: string, level = 1, list = 1) =>
  `<p class=MsoListParagraph style='text-indent:-18.0pt;mso-list:l0 level${level} lfo${list}'><![if !supportLists]><span style='font-family:Symbol'><span style='mso-list:Ignore'>${marker}<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;</span></span></span><![endif]>${words}</p>`;

describe("wordLists", () => {
  it("leaves a paste with no Word list as it is", () => {
    const html = "<p class=MsoNormal>Satu <b>dua</b></p>";
    expect(wordLists(html)).toBe(html);
  });

  it("turns a bulleted run into one list, without Word's marker", () => {
    expect(wordLists(item("·", "satu") + item("·", "dua"))).toBe(
      "<ul><li><p>satu</p></li><li><p>dua</p></li></ul>"
    );
  });

  it("turns a counted run into a numbered list, whatever the marker counts with", () => {
    expect(wordLists(item("1.", "satu") + item("2.", "dua"))).toContain(
      "<ol><li><p>satu</p></li><li><p>dua</p></li></ol>"
    );
    expect(wordLists(item("a)", "satu"))).toContain("<ol>");
    expect(wordLists(item("(iv)", "satu"))).toContain("<ol>");
  });

  it("nests a deeper item under the item above it", () => {
    expect(
      wordLists(item("1.", "satu") + item("o", "dalam", 2) + item("2.", "dua"))
    ).toBe(
      "<ol><li><p>satu</p><ul><li><p>dalam</p></li></ul></li><li><p>dua</p></li></ol>"
    );
  });

  it("keeps a list of another Word list, or one a paragraph interrupts, apart", () => {
    expect(wordLists(item("·", "satu") + item("·", "dua", 1, 2))).toBe(
      "<ul><li><p>satu</p></li></ul><ul><li><p>dua</p></li></ul>"
    );
    expect(
      wordLists(`${item("·", "satu")}<p>di antara</p>${item("·", "dua")}`)
    ).toBe(
      "<ul><li><p>satu</p></li></ul><p>di antara</p><ul><li><p>dua</p></li></ul>"
    );
  });

  it("reads a paste without the conditional comments by the span Word tells a browser to ignore", () => {
    expect(
      wordLists(
        "<p style='mso-list:l0 level1 lfo1'><span style='mso-list:Ignore'>1.&nbsp;</span>satu</p>"
      )
    ).toBe("<ol><li><p>satu</p></li></ol>");
  });

  it("keeps the marks of an item's words", () => {
    expect(wordLists(item("·", "<b>tebal</b> biasa"))).toBe(
      "<ul><li><p><b>tebal</b> biasa</p></li></ul>"
    );
  });

  it("leaves a styled paragraph that names no list as it is", () => {
    expect(wordLists(`<p style='margin:0'>biasa</p>${item("·", "satu")}`)).toBe(
      '<p style="margin:0">biasa</p><ul><li><p>satu</p></li></ul>'
    );
  });
});

describe("wholeLists", () => {
  const { schema } = new Editor({ element: null, extensions: [StarterKit] });
  const item = (text: string) =>
    schema.nodes.listItem.create(
      null,
      schema.nodes.paragraph.create(null, schema.text(text))
    );
  const list = (...texts: readonly string[]) =>
    schema.nodes.bulletList.create(null, Arr.map(texts, item));

  it("closes a paste that opens with a list of several items, so its first item stays one", () => {
    const pasted = new Slice(Fragment.from(list("satu", "dua")), 3, 3);

    expect(wholeLists(pasted)).toEqual(
      new Slice(Fragment.from(list("satu", "dua")), 0, 3)
    );
  });

  it("closes a list of one item with more blocks after it", () => {
    const content = Fragment.fromArray([
      list("satu"),
      schema.nodes.paragraph.create(null, schema.text("akhir")),
    ]);

    expect(wholeLists(new Slice(content, 3, 1)).openStart).toBe(0);
  });

  it("leaves part of one item open, so it joins the line at the caret", () => {
    const pasted = new Slice(Fragment.from(list("satu")), 3, 3);

    expect(wholeLists(pasted)).toBe(pasted);
  });

  it("leaves a paste that opens with anything else as it is, and an empty one", () => {
    const paragraph = new Slice(
      Fragment.from(schema.nodes.paragraph.create(null, schema.text("biasa"))),
      1,
      1
    );

    expect(wholeLists(paragraph)).toBe(paragraph);
    expect(wholeLists(Slice.empty)).toBe(Slice.empty);
  });
});

describe("wordPaste", () => {
  it("runs every paste of the editor through the reading of Word's lists", () => {
    const editor = new Editor({
      element: null,
      extensions: [StarterKit, wordPaste],
    });

    const transforms = Arr.flatMap(editor.extensionManager.plugins, (plugin) =>
      Arr.fromNullishOr(plugin.props.transformPastedHTML)
    );

    expect(transforms).toHaveLength(1);
  });
});
