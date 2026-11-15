import { describe, expect, it } from "@effect/vitest";
import type {
  ContentTreeChild,
  ContentTreeElement,
  ContentTreeProps,
} from "@nakafa/aksara-contracts/tree";
import {
  contentOutline,
  headingIdOf,
  ParsedHeadingSchema,
} from "@repo/contents/toc";
import { Array as Arr, Option, Schema } from "effect";

/** One element of a content tree, as the signed artifact holds it. */
function node(
  name: string,
  children: readonly ContentTreeChild[] = [],
  props: ContentTreeProps = {}
): ContentTreeElement {
  return { $node: "element", children, name, props };
}

/** A page of the given nodes, under the fragment that a signed tree starts with. */
const page = (...children: readonly ContentTreeChild[]) =>
  node("fragment", children);

/** The headings of a page from level marks and words, such as `["h2", "Child"]`. */
const headings = (...marks: readonly (readonly [string, string])[]) =>
  page(...Arr.map(marks, ([tag, words]) => node(tag, [words])));

describe("headingIdOf", () => {
  it("gives no anchor to an element that is not a heading", () => {
    expect(headingIdOf(node("p", ["Words"]))).toEqual(Option.none());
  });

  it("anchors a heading at the words the reader sees, formulas by their source", () => {
    const heading = node("h2", [
      "Area of ",
      node("strong", ["a"]),
      " ",
      node("InlineMath", [], { math: "\\pi r^2" }),
    ]);

    expect(headingIdOf(heading)).toEqual(Option.some("area-of-a-pi-r^2"));
  });

  it("keeps the anchor the author gave a heading", () => {
    expect(headingIdOf(node("h3", ["Words"], { id: "custom-anchor" }))).toEqual(
      Option.some("custom-anchor")
    );
  });
});

describe("contentOutline", () => {
  it("is empty for a page without headings", () => {
    expect(contentOutline(page("Text", node("p", ["More"])))).toEqual([]);
  });

  it("lists the headings inside other elements in the order the page draws them", () => {
    const tree = page(
      node("p", ["Intro"]),
      node("section", [node("h2", ["Inside"]), node("p", ["Body"])]),
      node("h2", [node("em", ["After"])])
    );

    expect(contentOutline(tree)).toEqual([
      { children: [], href: "#inside", label: "Inside" },
      { children: [], href: "#after", label: "After" },
    ]);
  });

  it("labels a heading with its words and links the anchor the renderer gives it", () => {
    const tree = page(
      node("h2", ["Heading with ", node("strong", ["bold"]), " words"]),
      node("h2", [node("InlineMath", [], { math: "\\alpha" })]),
      node("h2", ["Authored"], { id: "own" })
    );

    expect(contentOutline(tree)).toEqual([
      {
        children: [],
        href: "#heading-with-bold-words",
        label: "Heading with bold words",
      },
      { children: [], href: "#alpha", label: "alpha" },
      { children: [], href: "#own", label: "Authored" },
    ]);
  });

  it("nests siblings and skipped levels without stale ancestors", () => {
    const outline = contentOutline(
      headings(
        ["h1", "First"],
        ["h2", "Child"],
        ["h3", "Grandchild"],
        ["h2", "Sibling"],
        ["h4", "Deep"],
        ["h1", "Second"],
        ["h3", "Fresh"],
        ["h1", "Third"]
      )
    );

    expect(outline).toEqual([
      {
        children: [
          {
            children: [
              { children: [], href: "#grandchild", label: "Grandchild" },
            ],
            href: "#child",
            label: "Child",
          },
          {
            children: [{ children: [], href: "#deep", label: "Deep" }],
            href: "#sibling",
            label: "Sibling",
          },
        ],
        href: "#first",
        label: "First",
      },
      {
        children: [{ children: [], href: "#fresh", label: "Fresh" }],
        href: "#second",
        label: "Second",
      },
      { children: [], href: "#third", label: "Third" },
    ]);
  });

  it("supports all six levels and returns to a new root", () => {
    const outline = contentOutline(
      headings(
        ["h1", "L1"],
        ["h2", "L2"],
        ["h3", "L3"],
        ["h4", "L4"],
        ["h5", "L5"],
        ["h6", "L6"],
        ["h1", "Next"]
      )
    );

    expect(
      outline[0].children[0].children[0].children[0].children[0].children[0]
    ).toEqual({ children: [], href: "#l6", label: "L6" });
    expect(outline[1]).toEqual({ children: [], href: "#next", label: "Next" });
  });

  it("places orphan headings at the root and binds descendants to the current branch", () => {
    const outline = contentOutline(
      headings(
        ["h6", "Orphan"],
        ["h3", "Section"],
        ["h5", "Child"],
        ["h2", "New"],
        ["h4", "Fresh"]
      )
    );

    expect(Arr.map(outline, ({ label }) => label)).toEqual([
      "Orphan",
      "Section",
      "New",
    ]);
    expect(outline[0].children).toEqual([]);
    expect(Arr.map(outline[1].children, ({ label }) => label)).toEqual([
      "Child",
    ]);
    expect(Arr.map(outline[2].children, ({ label }) => label)).toEqual([
      "Fresh",
    ]);
  });

  it("keeps duplicate headings, each with the anchor its words give", () => {
    const outline = contentOutline(
      headings(["h1", "Duplicate"], ["h2", "Duplicate"], ["h1", "End"])
    );

    expect(outline).toEqual([
      {
        children: [{ children: [], href: "#duplicate", label: "Duplicate" }],
        href: "#duplicate",
        label: "Duplicate",
      },
      { children: [], href: "#end", label: "End" },
    ]);
  });
});

describe("ParsedHeadingSchema", () => {
  it("describes the nested headings that contentOutline returns", () => {
    const outline = contentOutline(
      headings(["h1", "Main"], ["h2", "Child"], ["h3", "Leaf"])
    );

    expect(
      Schema.decodeSync(Schema.Array(ParsedHeadingSchema))(outline)
    ).toEqual(outline);
  });
});
