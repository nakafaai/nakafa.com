import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { parseMinutes } from "@/components/exams/sitting/minutes";

describe("parseMinutes", () => {
  it("reads a whole number of minutes from one to 120", () => {
    expect(parseMinutes("1")).toEqual(Option.some(1));
    expect(parseMinutes("45")).toEqual(Option.some(45));
    expect(parseMinutes("120")).toEqual(Option.some(120));
  });

  it("refuses a number below one or above 120", () => {
    expect(parseMinutes("0")).toEqual(Option.none());
    expect(parseMinutes("-3")).toEqual(Option.none());
    expect(parseMinutes("121")).toEqual(Option.none());
  });

  it("refuses a fraction and text that is not a number", () => {
    expect(parseMinutes("1.5")).toEqual(Option.none());
    expect(parseMinutes("")).toEqual(Option.none());
    expect(parseMinutes("abc")).toEqual(Option.none());
  });
});
