import { describe, expect, it } from "@effect/vitest";
import { demoTime } from "@/components/marketing/school/features/clock";

describe("demoTime", () => {
  it("writes the demo's time of day the way each locale writes it", () => {
    expect(demoTime("en", 0)).toBe("10:02 AM");
    expect(demoTime("id", 3)).toBe("10.05");
    expect(demoTime("de", 10)).toBe("10:12");
  });
});
