// @vitest-environment jsdom

import { describe, expect, it } from "@effect/vitest";
import {
  type DocumentRules,
  documentExtensions,
  documentSchema,
} from "@repo/design-system/components/editor/document";
import { Editor } from "@tiptap/core";
import { Record as Rec } from "effect";

/** The rules of the tests: headings of levels 1 to 3, and links to https addresses only. */
const RULES = {
  headingLevels: [1, 2, 3],
  isLinkAllowed: (href: string) => href.startsWith("https://"),
} satisfies Omit<DocumentRules, "marks">;

/** A headless editor that holds a document of the test rules, with the marks it is given. */
function openEditor(marks: DocumentRules["marks"]) {
  return new Editor({
    element: null,
    extensions: documentExtensions({ ...RULES, marks }),
  });
}

describe("documentSchema", () => {
  it("holds exactly the marks it is given, in the order it is given them", () => {
    const schema = documentSchema({
      ...RULES,
      marks: [
        "bold",
        "italic",
        "underline",
        "code",
        "subscript",
        "superscript",
        "link",
      ],
    });
    expect(Rec.keys(schema.marks)).toEqual([
      "bold",
      "italic",
      "underline",
      "code",
      "subscript",
      "superscript",
      "link",
    ]);
  });

  it("offers no strike and no highlight, and ranks link after bold when the list gives bold first", () => {
    const schema = documentSchema({ ...RULES, marks: ["bold", "link"] });
    expect(Rec.keys(schema.marks)).toEqual(["bold", "link"]);
  });

  it("follows the list when the list gives link first", () => {
    const schema = documentSchema({ ...RULES, marks: ["link", "bold"] });
    expect(Rec.keys(schema.marks)).toEqual(["link", "bold"]);
  });
});

describe("documentExtensions", () => {
  it("offers only the heading levels its rules give", () => {
    const editor = openEditor([]);
    expect(editor.can().setHeading({ level: 3 })).toBe(true);
    expect(editor.can().setHeading({ level: 4 })).toBe(false);
  });

  it("holds no horizontal rule, because a document of its kind holds none", () => {
    const editor = openEditor([]);
    expect(Rec.keys(editor.schema.nodes)).not.toContain("horizontalRule");
  });

  it("refuses a link to an address its rules refuse, and takes one they allow", () => {
    const editor = openEditor(["link"]);
    editor.commands.setContent("<p>Nakafa</p>");
    editor.commands.setTextSelection({ from: 1, to: 7 });
    expect(editor.can().setLink({ href: "http://nakafa.com" })).toBe(false);
    expect(editor.can().setLink({ href: "https://nakafa.com" })).toBe(true);
  });
});
