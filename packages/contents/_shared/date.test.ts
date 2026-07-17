import {
  formatContentDateISO,
  parseContentDate,
} from "@repo/contents/_shared/date";
import { Option } from "effect";
import { describe, expect, it } from "vitest";

describe("content date helpers", () => {
  it("parses repository dates using ISO date-only strings", () => {
    const parsed = parseContentDate("2024-03-19");

    expect(Option.isSome(parsed)).toBe(true);
    if (Option.isNone(parsed)) {
      return;
    }

    expect(parsed.value.getUTCFullYear()).toBe(2024);
    expect(parsed.value.getUTCMonth()).toBe(2);
    expect(parsed.value.getUTCDate()).toBe(19);
    expect(parsed.value.getUTCHours()).toBe(0);
    expect(parsed.value.getUTCMinutes()).toBe(0);
    expect(parsed.value.getUTCSeconds()).toBe(0);
    expect(parsed.value.getUTCMilliseconds()).toBe(0);
  });

  it("rejects invalid or non-canonical date strings", () => {
    expect(Option.isNone(parseContentDate("not-a-date"))).toBe(true);
    expect(Option.isNone(parseContentDate("2024/03/19"))).toBe(true);
    expect(Option.isNone(parseContentDate("2024-3-19"))).toBe(true);
    expect(Option.isNone(parseContentDate("2024-02-30"))).toBe(true);
  });

  it("formats valid repository dates to ISO strings", () => {
    expect(formatContentDateISO("2024-03-19")).toEqual(
      Option.some("2024-03-19T00:00:00.000Z")
    );
  });
});
