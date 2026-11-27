import { describe, expect, it } from "@effect/vitest";
import {
  fitWidth,
  menuPlaceOf,
  placeOf,
} from "@/components/shared/table/align";

describe("menuPlaceOf", () => {
  it("opens the first column's menu at the start, the last's at the end, and the rest centred", () => {
    expect(menuPlaceOf(0, 4)).toBe("start");
    expect(menuPlaceOf(2, 4)).toBe("center");
    expect(menuPlaceOf(4, 4)).toBe("end");
  });
});

describe("placeOf", () => {
  it("starts the column that names the row, keeps a column's own place, and centres the rest", () => {
    expect(placeOf(0, undefined)).toBe("start");
    expect(placeOf(1, undefined)).toBe("center");
    expect(placeOf(3, "end")).toBe("end");
    expect(placeOf(4, "menu")).toBe("menu");
  });
});

describe("fitWidth", () => {
  it("sizes a column of known values by its longest value or its head's name, whichever is longer", () => {
    expect(fitWidth("Level", ["Easy", "Medium", "Hard"])).toBe(
      "calc(6ch + 4rem)"
    );
    expect(fitWidth("Measured level", ["Easy"])).toBe("calc(14ch + 4rem)");
    expect(fitWidth("Status", [])).toBe("calc(6ch + 4rem)");
  });

  it("widens a column of names to the longest name of the reader's language", () => {
    expect(fitWidth("Name", ["Set 1", "Set 10"])).toBe("calc(6ch + 4rem)");
    expect(fitWidth("Name", ["Aufgabensatz 1", "Aufgabensatz 10"])).toBe(
      "calc(15ch + 4rem)"
    );
  });
});
