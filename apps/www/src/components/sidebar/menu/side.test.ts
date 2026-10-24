import { describe, expect, it } from "@effect/vitest";
import type { SidebarContextValue } from "@repo/design-system/lib/sidebar/context";
import { selectMenuSide } from "@/components/sidebar/menu/side";

/** The part of the sidebar state that picks the side of a menu. */
function sidebarOf(isMobile: boolean) {
  return { isMobile } as SidebarContextValue;
}

describe("the side of a sidebar menu", () => {
  it("opens beside the sidebar on desktop", () => {
    expect(selectMenuSide(sidebarOf(false))).toBe("right");
  });

  it("opens above its trigger on a phone", () => {
    expect(selectMenuSide(sidebarOf(true))).toBe("top");
  });
});
