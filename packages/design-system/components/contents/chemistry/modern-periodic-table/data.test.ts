import { describe, expect, it } from "@effect/vitest";
import {
  getModernPeriodicTableCategoryColor,
  getModernPeriodicTableSceneColors,
  getPeriodicElementCategoryCount,
  isModernPeriodicTableFocusId,
  PERIODIC_ELEMENT_CATEGORY_IDS,
  parseMainEntry,
  parseSeriesEntry,
} from "@repo/design-system/components/contents/chemistry/modern-periodic-table/data";
import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { Array as Arr, Result } from "effect";

describe("modern periodic table data", () => {
  it("recognizes only the periodic table focus ids", () => {
    expect(isModernPeriodicTableFocusId("group-one")).toBe(true);
    expect(isModernPeriodicTableFocusId("series-marker")).toBe(false);
  });

  it("counts every element tile once across the main table and the f-block rows", () => {
    const total = Arr.reduce(
      PERIODIC_ELEMENT_CATEGORY_IDS,
      0,
      (sum, categoryId) => sum + getPeriodicElementCategoryCount(categoryId)
    );

    expect(total).toBe(118);
  });

  it("counts the lanthanides and actinides as inner transition elements", () => {
    expect(getPeriodicElementCategoryCount("inner-transition")).toBe(30);
  });

  it("reads a main-table entry with its group, symbol and atomic number", () => {
    expect(Result.getOrThrow(parseMainEntry("1:H:1"))).toEqual({
      atomicNumber: 1,
      category: "nonmetal",
      group: 1,
      symbol: "H",
    });
  });

  it("reads a series marker in the main table without an atomic number", () => {
    expect(Result.getOrThrow(parseMainEntry("3:57-71"))).toEqual({
      category: "series-marker",
      group: 3,
      symbol: "57-71",
    });
  });

  it("reads an f-block entry in atomic number and symbol form", () => {
    expect(Result.getOrThrow(parseSeriesEntry("57:La"))).toEqual({
      atomicNumber: 57,
      category: "inner-transition",
      symbol: "La",
    });
  });

  it.each(["x:H:1", "1::1", "1:H:x", "1:Xx:1"])(
    "fails to read the main-table entry %s",
    (source) => {
      expect(Result.isFailure(parseMainEntry(source))).toBe(true);
    }
  );

  it.each(["x:La", "57", "57:Xx"])(
    "fails to read the f-block entry %s",
    (source) => {
      expect(Result.isFailure(parseSeriesEntry(source))).toBe(true);
    }
  );

  it("draws scene text in light ink on a dark theme and dark ink on a light theme", () => {
    expect(getModernPeriodicTableSceneColors("dark").text).toBe(
      ORIGIN_COLOR.LIGHT
    );
    expect(getModernPeriodicTableSceneColors("light").text).toBe(
      ORIGIN_COLOR.DARK
    );
  });

  it("gives every element category its own legend color", () => {
    const colors = getModernPeriodicTableSceneColors("light");
    const categoryColors = Arr.map(
      PERIODIC_ELEMENT_CATEGORY_IDS,
      (categoryId) => getModernPeriodicTableCategoryColor(colors, categoryId)
    );

    expect(Arr.dedupe(categoryColors)).toHaveLength(
      PERIODIC_ELEMENT_CATEGORY_IDS.length
    );
  });
});
