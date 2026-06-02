import {
  formatContentDateISO,
  isContentDateString,
  parseContentDate,
} from "@repo/contents/_shared/date";
import { Option } from "effect";
import { describe, expect, it } from "vitest";

describe("content date helpers", () => {
  it("parses repository dates using MM/DD/YYYY", () => {
    const parsed = parseContentDate("03/19/2024");

    expect(Option.isSome(parsed)).toBe(true);
    if (Option.isNone(parsed)) {
      return;
    }

    expect(parsed.value.getFullYear()).toBe(2024);
    expect(parsed.value.getMonth()).toBe(2);
    expect(parsed.value.getDate()).toBe(19);
    expect(parsed.value.getHours()).toBe(0);
    expect(parsed.value.getMinutes()).toBe(0);
    expect(parsed.value.getSeconds()).toBe(0);
    expect(parsed.value.getMilliseconds()).toBe(0);
  });

  it("rejects invalid or non-canonical date strings", () => {
    expect(Option.isNone(parseContentDate("19/03/2024"))).toBe(true);
    expect(Option.isNone(parseContentDate("2024-03-19"))).toBe(true);
    expect(Option.isNone(parseContentDate("3/19/2024"))).toBe(true);
    expect(isContentDateString("13/40/2024")).toBe(false);
  });

  it("formats valid repository dates to ISO strings", () => {
    expect(Option.isSome(formatContentDateISO("03/19/2024"))).toBe(true);
  });
});
