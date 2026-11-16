import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option, Result, Schema } from "effect";
import {
  draftOf,
  emptyDraft,
  type Field,
  FieldSchema,
  fieldOf,
  figureForm,
  figureOf,
  getAt,
  initialCase,
  initialValue,
  labelOf,
  richOfText,
  setAt,
  textOfRich,
} from "@/components/tenant/exams/figure/form";

/** The name and kind of each prop of a group. */
function kinds(field: Field) {
  return field.kind === "group"
    ? Arr.map(field.props, ({ field: prop, name }) => [name, prop.kind])
    : [];
}

/** The item of the lab's list of items. */
function itemOf(field: Field): Field {
  const labels =
    field.kind === "group"
      ? Arr.findFirst(field.props, ({ name }) => name === "labels")
      : Option.none();
  const items = Option.flatMap(labels, ({ field: group }) =>
    group.kind === "group"
      ? Arr.findFirst(group.props, ({ name }) => name === "items")
      : Option.none()
  );
  return Option.match(items, {
    onNone: () => field,
    onSome: ({ field: list }) => (list.kind === "list" ? list.item : list),
  });
}

describe("figure forms", () => {
  it("reads a lab's props as rich text, plain text, fixed values, and groups", () => {
    const form = figureForm("AtomShellLab");

    expect(Schema.is(FieldSchema)(form)).toBe(true);
    expect(form).toMatchObject({
      kind: "group",
      props: [
        {
          field: {
            kind: "choice",
            options: [
              "neon",
              "magnesium",
              "chlorine",
              "argon",
              "potassium",
              "calcium",
            ],
          },
          name: "defaultSampleId",
          optional: true,
        },
        { field: { kind: "rich" }, name: "description", optional: true },
        { field: { kind: "group" }, name: "labels", optional: false },
        { field: { kind: "rich" }, name: "title", optional: true },
      ],
    });
  });

  it("reads lists, shapes told apart by a tag, numbers, switches, and JSON", () => {
    expect(kinds(figureForm("BacteriaStructureLab"))).toEqual([
      ["defaultItemIndex", "number"],
      ["description", "rich"],
      ["labels", "group"],
      ["title", "rich"],
    ]);
    expect(kinds(itemOf(figureForm("BacteriaStructureLab")))).toEqual([
      ["callouts", "list"],
      ["caption", "rich"],
      ["focus", "rich"],
      ["tab", "text"],
      ["takeaway", "rich"],
      ["scene", "variant"],
    ]);
    expect(kinds(figureForm("ScatterDiagram"))).toContainEqual([
      "calculateRegressionLine",
      "boolean",
    ]);
    expect(kinds(figureForm("BarChart"))).toContainEqual([
      "chartConfig",
      "json",
    ]);
    expect(fieldOf(Schema.Tuple([Schema.Finite, Schema.Finite]).ast)).toEqual({
      kind: "json",
    });
    expect(fieldOf(Schema.Literal("only").ast)).toEqual({
      kind: "choice",
      options: ["only"],
    });
    expect(fieldOf(Schema.Union([Schema.String, Schema.Finite]).ast)).toEqual({
      kind: "json",
    });
    expect(
      fieldOf(
        Schema.Union([Schema.Struct({ a: Schema.String }), Schema.String]).ast
      )
    ).toEqual({ kind: "json" });
    expect(
      fieldOf(
        Schema.Union([
          Schema.Struct({ a: Schema.String }),
          Schema.Struct({ b: Schema.String }),
        ]).ast
      )
    ).toEqual({ kind: "json" });
  });
});

describe("new figures", () => {
  it("start each required prop at its own start and leave optional ones out", () => {
    expect(emptyDraft("UnitCircle")).toEqual({
      alt: "",
      caption: "",
      component: "UnitCircle",
      props: { description: undefined, title: undefined },
    });
    expect(
      initialValue({
        item: { kind: "boolean" },
        kind: "list",
      })
    ).toEqual([false]);
    expect(initialValue({ kind: "json" })).toEqual({});
    expect(initialValue({ kind: "text" })).toBe("");
    expect(initialValue({ kind: "choice", options: ["a"] })).toBe("a");
  });

  it("start a shape with its tag set, and nothing for a shape it lacks", () => {
    const variant = {
      cases: [
        {
          group: {
            kind: "group" as const,
            props: [
              {
                field: { kind: "number" as const },
                name: "radius",
                optional: false,
              },
            ],
          },
          value: "circle",
        },
      ],
      kind: "variant" as const,
      tag: "kind",
    };

    expect(initialValue(variant)).toEqual({ kind: "circle", radius: 0 });
    expect(initialCase(variant, 3)).toEqual({});
  });
});

describe("rich text lines", () => {
  it("write words and formulas between dollars, and read them back", () => {
    const rich = richOfText("Speed $v = 2$ m/s");

    expect(rich).toEqual([
      { text: "Speed ", type: "text" },
      { attrs: { latex: "v = 2" }, type: "mathInline" },
      { text: " m/s", type: "text" },
    ]);
    expect(textOfRich(rich)).toBe("Speed $v = 2$ m/s");
    expect(richOfText("$ $")).toBeUndefined();
    expect(textOfRich(undefined)).toBe("");
  });
});

describe("getAt and labelOf", () => {
  it("read a value at a path, and a prop's name as words", () => {
    expect(getAt({ a: [{ b: 2 }] }, ["a", 0, "b"])).toBe(2);
    expect(getAt({ a: 1 }, ["a", "b"])).toBeUndefined();
    expect(getAt([1], ["a"])).toBeUndefined();
    expect(labelOf("chooseAtom")).toBe("Choose atom");
    expect(labelOf("first-cut")).toBe("First cut");
  });
});

describe("setAt", () => {
  it("writes one prop or item, and removes a prop written as undefined", () => {
    const props = {
      labels: { items: [{ tab: "A" }, { tab: "C" }] },
      title: "T",
    };

    expect(setAt(props, ["labels", "items", 0, "tab"], "B")).toEqual({
      labels: { items: [{ tab: "B" }, { tab: "C" }] },
      title: "T",
    });
    expect(setAt(props, ["title"], undefined)).toEqual({
      labels: { items: [{ tab: "A" }, { tab: "C" }] },
    });
    expect(setAt(undefined, ["a", 0], 1)).toEqual({ a: [] });
  });
});

describe("figureOf", () => {
  it("builds a figure its catalog schema accepts, or names what it refuses", () => {
    const empty = emptyDraft("UnitCircle");
    const filled = {
      ...empty,
      alt: " An angle of thirty degrees ",
      caption: "Angle $A$",
      props: {
        angle: 30,
        description: richOfText("Thirty degrees."),
        title: richOfText("Angle"),
      },
    };
    const built = figureOf(filled);

    expect(Result.isFailure(figureOf(empty))).toBe(true);
    expect(Result.getOrThrow(built)).toEqual({
      alt: "An angle of thirty degrees",
      caption: [
        { text: "Angle ", type: "text" },
        { attrs: { latex: "A" }, type: "mathInline" },
      ],
      component: "UnitCircle",
      props: filled.props,
    });
    expect(draftOf(Result.getOrThrow(built))).toEqual({
      ...filled,
      alt: "An angle of thirty degrees",
    });
    expect(
      draftOf({ ...Result.getOrThrow(built), caption: null }).caption
    ).toBe("");
  });
});
