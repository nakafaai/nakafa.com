import { describe, expect, it } from "@effect/vitest";
import { biologyReadings } from "@repo/design-system/components/contents/biology/readings";

describe("the readings of a biology lab footer", () => {
  it("lists the focus and the takeaway beside their terms, in footer order", () => {
    expect(
      biologyReadings(
        { focus: "Membrane", takeaway: "Shape" },
        { focusLabel: "Focus", takeawayLabel: "Takeaway" }
      )
    ).toEqual([
      { key: "focus", label: "Focus", value: "Membrane" },
      { key: "takeaway", label: "Takeaway", value: "Shape" },
    ]);
  });

  it("does not show a value that has no term", () => {
    expect(
      biologyReadings(
        { focus: "Membrane", takeaway: "Shape" },
        { takeawayLabel: "Takeaway" }
      )
    ).toEqual([{ key: "takeaway", label: "Takeaway", value: "Shape" }]);
  });

  it("shows no reading for a term that has no value", () => {
    expect(
      biologyReadings({}, { focusLabel: "Focus", takeawayLabel: "Takeaway" })
    ).toEqual([]);
  });
});
