import { describe, expect, it } from "@effect/vitest";
import { pageAt } from "@/components/tenant/exams/pages";

describe("pageAt", () => {
  it("names the page whose top has reached the line", () => {
    expect(pageAt([0, 300, 700], 0)).toBe(0);
    expect(pageAt([0, 300, 700], 299)).toBe(0);
    expect(pageAt([0, 300, 700], 300)).toBe(1);
    expect(pageAt([0, 300, 700], 900)).toBe(2);
  });

  it("names the first page while no page top has reached the line yet", () => {
    expect(pageAt([120, 400], 10)).toBe(0);
  });

  it("names the first page of an exam with no page", () => {
    expect(pageAt([], 0)).toBe(0);
  });
});
