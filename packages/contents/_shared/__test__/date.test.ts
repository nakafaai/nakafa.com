import {
  formatContentDateISO,
  isContentDateString,
  parseContentDate,
} from "@repo/contents/_shared/date";
import { describe, expect, it } from "vitest";

describe("content date helpers", () => {
  it("parses repository dates using MM/DD/YYYY", () => {
    const parsed = parseContentDate("03/19/2024");

    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2024);
    expect(parsed?.getMonth()).toBe(2);
    expect(parsed?.getDate()).toBe(19);
  });

  it("rejects invalid or non-canonical date strings", () => {
    expect(parseContentDate("19/03/2024")).toBeNull();
    expect(parseContentDate("2024-03-19")).toBeNull();
    expect(isContentDateString("13/40/2024")).toBe(false);
  });

  it("formats valid repository dates to ISO strings", () => {
    expect(formatContentDateISO("03/19/2024")).toBeTruthy();
  });
});
