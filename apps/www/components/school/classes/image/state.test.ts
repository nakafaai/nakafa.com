import { describe, expect, it } from "vitest";
import { updateClassImageState } from "@/components/school/classes/image/state";

describe("updateClassImageState", () => {
  it("replaces the image and preserves the remaining route state", () => {
    const state = {
      class: { image: "retro" as const, name: "Matematika" },
      kind: "accessible" as const,
    };

    expect(updateClassImageState(state, "stars")).toEqual({
      class: { image: "stars", name: "Matematika" },
      kind: "accessible",
    });
  });
});
