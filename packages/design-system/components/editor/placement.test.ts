import { describe, expect, it } from "@effect/vitest";
import {
  MENU_GAP,
  MENU_MAX_HEIGHT,
  menuPlacement,
} from "@repo/design-system/components/editor/placement";

describe("menuPlacement", () => {
  it("hangs the menu under the query when its tallest height fits below it", () => {
    expect(menuPlacement({ bottom: 100, top: 80 }, 1000)).toEqual({
      bottom: null,
      top: 100 + MENU_GAP,
    });
  });

  it("stands the menu over the query when its tallest height does not fit below it", () => {
    expect(menuPlacement({ bottom: 500, top: 480 }, 720)).toEqual({
      bottom: 720 - 480 + MENU_GAP,
      top: null,
    });
  });

  it("hangs the menu when its tallest height ends exactly at the bottom of the window", () => {
    const bottom = 720 - MENU_GAP - MENU_MAX_HEIGHT;

    expect(menuPlacement({ bottom, top: bottom - 20 }, 720)).toEqual({
      bottom: null,
      top: bottom + MENU_GAP,
    });
  });
});
