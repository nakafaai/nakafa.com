import { formatContentDateISO } from "@repo/contents/_shared/date";
import { Option } from "effect";
import { describe, expect, it } from "vitest";

describe("content date helpers", () => {
  it("rejects invalid or non-canonical date strings", () => {
    expect(Option.isNone(formatContentDateISO("not-a-date"))).toBe(true);
    expect(Option.isNone(formatContentDateISO("2024/03/19"))).toBe(true);
    expect(Option.isNone(formatContentDateISO("2024-3-19"))).toBe(true);
    expect(Option.isNone(formatContentDateISO("2024-02-30"))).toBe(true);
  });

  it("formats valid repository dates to ISO strings", () => {
    expect(formatContentDateISO("2024-03-19")).toEqual(
      Option.some("2024-03-19T00:00:00.000Z")
    );
  });
});
