// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  letterScript,
  optionLetter,
} from "@repo/design-system/lib/arabic/letters";
import { Array as Arr } from "effect";

describe("the script that names a set of options", () => {
  it("is Arabic when most letters of the labels are Arabic", () => {
    expect(letterScript(["كِتَابٌ", "قَلَمٌ", "بَيْتٌ"])).toBe("arabic");
    expect(letterScript(["مَدْرَسَةٌ", "school", "بَابٌ"])).toBe("arabic");
  });

  it("is Latin for a set in another script, or a mixed set most of whose letters are Latin", () => {
    expect(letterScript(["Buku", "Pensil", "Rumah"])).toBe("latin");
    expect(letterScript(["The book (كتاب)", "The pen", "The house"])).toBe(
      "latin"
    );
  });

  it("is Latin for a set without a letter, such as numbers", () => {
    expect(letterScript(["12", "24", "36"])).toBe("latin");
    expect(letterScript([])).toBe("latin");
  });
});

describe("the letter of an option", () => {
  it("names a Latin set from A", () => {
    expect(Arr.makeBy(5, (index) => optionLetter(index, "latin"))).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
    ]);
  });

  it("names an Arabic set in abjad order", () => {
    expect(Arr.makeBy(5, (index) => optionLetter(index, "arabic"))).toEqual([
      "أ",
      "ب",
      "ج",
      "د",
      "هـ",
    ]);
  });

  it("names an option of an Arabic set past the abjad as a Latin set names its place", () => {
    expect(optionLetter(28, "arabic")).toBe(optionLetter(28, "latin"));
    expect(optionLetter(27, "arabic")).toBe("غ");
  });
});
