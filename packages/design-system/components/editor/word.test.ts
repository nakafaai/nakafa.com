// @vitest-environment jsdom

import { describe, expect, it } from "@effect/vitest";
import { wordLists } from "@repo/design-system/components/editor/word";

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
      wordLists(
        item("1.", "satu") + item("o", "dalam", 2) + item("2.", "dua")
      )
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
    expect(
      wordLists(`<p style='margin:0'>biasa</p>${item("·", "satu")}`)
    ).toBe("<p style=\"margin:0\">biasa</p><ul><li><p>satu</p></li></ul>");
  });
});
