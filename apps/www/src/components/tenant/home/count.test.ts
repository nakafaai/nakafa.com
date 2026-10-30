import { describe, expect, it } from "@effect/vitest";
import { reachesBound } from "@/components/tenant/home/count";

describe("tenant home bounds", () => {
  it("reaches the bound once a read returns as many rows as it may, and not below it", () => {
    expect(reachesBound(5, 5)).toBe(true);
    expect(reachesBound(4, 5)).toBe(false);
  });
});
