import { describe, expect, it } from "@effect/vitest";
import { isFrozen, isLocked } from "@/components/tenant/exams/freeze";

describe("isFrozen", () => {
  it("reads an exam that a sitting has scheduled as frozen", () => {
    expect(isFrozen({ frozenAt: 1_760_000_000_000 })).toBe(true);
  });

  it("reads an exam that no sitting has scheduled as open", () => {
    expect(isFrozen({})).toBe(false);
  });
});

describe("isLocked", () => {
  it("locks an exam that is frozen or whose unit is archived, and no other", () => {
    expect(isLocked({ archived: false, frozenAt: 1_760_000_000_000 })).toBe(true);
    expect(isLocked({ archived: true })).toBe(true);
    expect(isLocked({ archived: false })).toBe(false);
  });
});
