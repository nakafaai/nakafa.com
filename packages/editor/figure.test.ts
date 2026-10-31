import { describe, expect, it } from "@effect/vitest";
import { documentSchema } from "@repo/editor/document";
import { DOMParser, DOMSerializer } from "@tiptap/pm/model";

/** A schema that holds a document with its figures. */
const schema = documentSchema({
  headingLevels: [1],
  isLinkAllowed: () => true,
  marks: [],
});

/** The attributes of a figure, as the contract stores them. */
const attrs = {
  alt: "Sebuah diagram",
  caption: null,
  component: "Mermaid",
  props: { chart: "graph TD; A-->B", description: "Alur", title: "Alur" },
};

describe("editor/figure", () => {
  it("writes a figure's attributes into its markup and reads them back", () => {
    const figure = schema.nodes.figure.create(attrs);
    const wrapper = document.createElement("div");
    wrapper.append(DOMSerializer.fromSchema(schema).serializeNode(figure));

    const element = wrapper.querySelector('figure[data-type="figure"]');
    expect(element?.getAttribute("data-alt")).toBe(attrs.alt);
    expect(
      DOMParser.fromSchema(schema).parse(wrapper).firstChild?.attrs
    ).toEqual(attrs);
  });

  it("reads markup that holds no JSON as a figure without props or caption", () => {
    const wrapper = document.createElement("div");
    const element = document.createElement("figure");
    element.dataset.type = "figure";
    element.dataset.props = "{not json";
    wrapper.append(element);

    expect(
      DOMParser.fromSchema(schema).parse(wrapper).firstChild?.attrs
    ).toEqual({ alt: "", caption: null, component: "", props: {} });
  });
});
