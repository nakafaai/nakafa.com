import { describe, expect, it } from "@effect/vitest";
import { documentSchema } from "@repo/editor/document";
import { toneOf } from "@repo/editor/highlight";
import { Record as Rec } from "effect";

/** A document schema that holds the highlight. */
const schema = documentSchema({
  headingLevels: [1],
  isLinkAllowed: () => true,
  marks: ["bold", "highlight"],
});

/** An element of a highlight's markup, with the tone it names. */
const elementOf = (tone: string | null) => ({
  getAttribute: (name: string) => (name === "data-variant" ? tone : null),
});

describe("editor/highlight", () => {
  it("writes a highlight as a strong phrase with its tone, after bold", () => {
    const mark = schema.marks.highlight.create({ variant: "success" });

    expect(Rec.keys(schema.marks)).toEqual(["bold", "highlight"]);
    expect(schema.marks.highlight.spec.toDOM?.(mark, true)).toEqual([
      "strong",
      { "data-type": "highlight", "data-variant": "success" },
      0,
    ]);
    expect(
      schema.marks.highlight.spec.toDOM?.(schema.marks.highlight.create(), true)
    ).toEqual(["strong", { "data-type": "highlight" }, 0]);
  });

  it("reads a tone of the contract back from markup, and none for another", () => {
    expect(schema.marks.highlight.spec.parseDOM?.[0]?.tag).toBe(
      'strong[data-type="highlight"]'
    );
    expect([
      toneOf(elementOf("warning")),
      toneOf(elementOf("danger")),
      toneOf(elementOf(null)),
    ]).toEqual(["warning", null, null]);
  });
});
