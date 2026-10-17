import { describe, expect, it } from "@effect/vitest";
import { storedBytes } from "@repo/backend/confect/nina/sealed/bytes";

describe("storedBytes", () => {
  it("counts text by its UTF-8 length, so a multi-byte letter takes more than one byte", () => {
    expect(storedBytes("abc")).toBe(3);
    expect(storedBytes("é")).toBe(2);
  });

  it("counts binary by its byte length", () => {
    expect(storedBytes(new ArrayBuffer(7))).toBe(7);
  });

  it("counts a number, a boolean and a big integer at one fixed cost, and a missing value at none", () => {
    expect(storedBytes(1)).toBe(storedBytes(123_456_789));
    expect(storedBytes(true)).toBe(storedBytes(1));
    expect(storedBytes(1n)).toBe(storedBytes(1));
    expect(storedBytes(null)).toBe(0);
    expect(storedBytes(undefined)).toBe(0);
  });

  it("adds up the keys and the values of an object, and the items of an array", () => {
    expect(storedBytes({ a: "xy" })).toBe(1 + 2);
    expect(storedBytes(["ab", "c"])).toBe(2 + 1);
    expect(storedBytes({ a: { b: "x" } })).toBe(1 + (1 + 1));
  });
});
