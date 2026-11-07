import { describe, expect, it } from "@effect/vitest";
import { lineAccounts, linePlan } from "@repo/backend/confect/billing/tier";
import { Option } from "effect";

describe("billing/tier", () => {
  it("counts the accounts each invoice line pays for, an Enterprise line by its seats", () => {
    expect(lineAccounts("school.pro", 1)).toBe(100);
    expect(lineAccounts("school.max", 1)).toBe(500);
    expect(lineAccounts("school.accounts", 37)).toBe(37);
    expect(lineAccounts("Kontrak Enterprise 2026/2027", 300)).toBe(300);
  });

  it("reads the paid plan a line sells, and none for accounts or an operator's line", () => {
    expect(linePlan("school.pro")).toStrictEqual(Option.some("pro"));
    expect(linePlan("school.max")).toStrictEqual(Option.some("max"));
    expect(linePlan("school.accounts")).toStrictEqual(Option.none());
    expect(linePlan("Pelatihan guru")).toStrictEqual(Option.none());
  });
});
