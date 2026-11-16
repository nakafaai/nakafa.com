import { describe, expect, it } from "@effect/vitest";
import { mapRichProps, mapRichText } from "@/lib/content/renderer/rich";

const title = [{ text: "Gate", type: "text" }];
const label = [{ attrs: { latex: "v_0" }, type: "mathInline" }];

describe("mapRichText", () => {
  it("draws every rich text of a figure's props and keeps its data", () => {
    expect(
      mapRichText(
        {
          labels: { factLabels: { initialVelocity: label } },
          series: [{ label: "A", values: [1, null] }],
          title,
        },
        (text) => `rich:${text.length}`
      )
    ).toEqual({
      labels: { factLabels: { initialVelocity: "rich:1" } },
      series: [{ label: "A", values: [1, null] }],
      title: "rich:1",
    });
  });

  it("leaves arrays that are not inline nodes as data", () => {
    expect(mapRichText([[1, 2], "x"], () => "rich")).toEqual([[1, 2], "x"]);
  });
});

describe("mapRichProps", () => {
  it("draws the rich text of each prop of a figure", () => {
    expect(mapRichProps({ angle: 30, title }, () => "rich")).toEqual({
      angle: 30,
      title: "rich",
    });
  });
});
