import { describe, expect, it } from "@effect/vitest";
import {
  optionRowVariants,
  optionTickVariants,
} from "@repo/design-system/lib/option";
import { cn } from "cn";

describe("optionRowVariants", () => {
  it("keeps end padding for the tick after cn merges size padding", () => {
    const defaultTick = cn(optionRowVariants({ mark: "tick" })).split(" ");
    const roomyTick = cn(
      optionRowVariants({ mark: "tick", size: "roomy" })
    ).split(" ");

    expect(defaultTick).toContain("px-2");
    expect(defaultTick).toContain("pe-8");
    expect(roomyTick).toContain("px-3");
    expect(roomyTick).toContain("pe-8");
  });

  it("omits tick padding when mark is none", () => {
    const plain = cn(optionRowVariants()).split(" ");

    expect(plain).toContain("px-2");
    expect(plain).not.toContain("pe-8");
  });

  it("positions the tick inside the reserved trailing padding", () => {
    const tick = optionTickVariants().split(" ");

    expect(tick).toContain("absolute");
    expect(tick).toContain("end-2");
  });
});
