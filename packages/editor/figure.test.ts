import { describe, expect, it } from "@effect/vitest";
import { documentSchema } from "@repo/editor/document";
import { FIGURE_ATTRIBUTES } from "@repo/editor/figure";
import { Record as Rec } from "effect";

/** The attributes of a figure, as the contract stores them. */
const attrs = {
  alt: "Sebuah diagram",
  caption: null,
  component: "Mermaid",
  props: { chart: "graph TD; A-->B", description: "Alur", title: "Alur" },
};

/** An element of a figure's markup, which keeps its attributes under these names. */
const elementOf = (attributes: Record<string, unknown>) => ({
  getAttribute: (name: string) => {
    const value = attributes[name];
    return typeof value === "string" ? value : null;
  },
});

/** The attributes the markup of `element` reads back. */
const readBack = (element: ReturnType<typeof elementOf>) =>
  Rec.map(FIGURE_ATTRIBUTES, (attribute) => attribute.parseHTML(element));

describe("editor/figure", () => {
  it("writes a figure's attributes into its markup and reads them back", () => {
    const written = Object.assign(
      {},
      ...Object.values(FIGURE_ATTRIBUTES).map((attribute) =>
        attribute.renderHTML(attrs)
      )
    );

    expect(written).toMatchObject({ "data-alt": attrs.alt });
    expect(readBack(elementOf(written))).toEqual(attrs);
  });

  it("reads markup that holds no JSON as a figure without props or caption", () => {
    expect(readBack(elementOf({ "data-props": "{not json" }))).toEqual({
      alt: "",
      caption: null,
      component: "",
      props: {},
    });
  });

  it("holds a figure as a block of the document, written as a figure element", () => {
    const schema = documentSchema({
      headingLevels: [1],
      isLinkAllowed: () => true,
      marks: [],
    });
    const figure = schema.nodes.figure.create(attrs);

    expect(figure.attrs).toEqual(attrs);
    expect(schema.nodes.figure.spec.parseDOM?.[0].tag).toBe(
      'figure[data-type="figure"]'
    );
  });
});
