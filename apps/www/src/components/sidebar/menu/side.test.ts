import { describe, expect, it } from "@effect/vitest";
import { selectMenuSide } from "@/components/sidebar/menu/side";

describe("the side of a sidebar menu", () => {
  it("opens beside the sidebar on desktop", () => {
    expect(selectMenuSide({ isMobile: false })).toBe("right");
  });

  it("opens above its trigger on a phone", () => {
    expect(selectMenuSide({ isMobile: true })).toBe("top");
  });
});
