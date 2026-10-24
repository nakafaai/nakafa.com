import { describe, expect, it } from "@effect/vitest";
import { waitingOf } from "@/components/tenant/home/waiting";

describe("tenant home waiting results", () => {
  it("counts only the closed sittings whose results may still be released", () => {
    expect(
      waitingOf([
        { canRelease: true },
        { canRelease: false },
        { canRelease: true },
      ])
    ).toBe(2);
  });

  it("counts no sitting for a school with no closed sitting", () => {
    expect(waitingOf([])).toBe(0);
  });
});
