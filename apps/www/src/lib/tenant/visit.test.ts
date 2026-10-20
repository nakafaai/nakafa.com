// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { reusesVisitFrame } from "@/lib/tenant/visit";

describe("reusesVisitFrame", () => {
  it("reads the frame when a visit enters the school", () => {
    expect(reusesVisitFrame({ cause: "enter", invalid: false })).toBe(false);
  });

  it("reuses the frame of a child navigation within the visit", () => {
    expect(reusesVisitFrame({ cause: "stay", invalid: false })).toBe(true);
  });

  it("reads the frame again after a refresh invalidates the school", () => {
    expect(reusesVisitFrame({ cause: "stay", invalid: true })).toBe(false);
  });

  it("reuses the frame that a preload of the school read", () => {
    expect(reusesVisitFrame({ cause: "preload", invalid: false })).toBe(true);
  });
});
