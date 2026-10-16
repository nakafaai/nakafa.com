// @vitest-environment jsdom

import { describe, expect, it } from "@effect/vitest";
import { documentSchema } from "@repo/design-system/components/editor/document";
import { Record as Rec } from "effect";

describe("documentSchema", () => {
  it("holds exactly the marks it is given, in the order it is given them", () => {
    const schema = documentSchema([
      "bold",
      "italic",
      "underline",
      "code",
      "subscript",
      "superscript",
      "link",
    ]);
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
    const schema = documentSchema(["bold", "link"]);
    expect(Rec.keys(schema.marks)).toEqual(["bold", "link"]);
  });

  it("follows the list when the list gives link first", () => {
    const schema = documentSchema(["link", "bold"]);
    expect(Rec.keys(schema.marks)).toEqual(["link", "bold"]);
  });
});
