import { describe, expect, it } from "vitest";
import {
  FORUM_BOTTOM_PREFETCH_VIEWPORTS,
  FORUM_MAX_BUFFERED_OLDER_PAGES,
  FORUM_SCROLL_SETTLE_DELAY,
  FORUM_TOP_PREFETCH_VIEWPORTS,
  FORUM_VIRTUAL_BUFFER_SIZE,
} from "@/components/school/classes/forum/conversation/utils/scroll-policy";

describe("forum conversation scroll policy", () => {
  it("uses aggressive prefetch thresholds, a small prepend buffer, and one modest settle delay", () => {
    expect(FORUM_TOP_PREFETCH_VIEWPORTS).toBe(1);
    expect(FORUM_BOTTOM_PREFETCH_VIEWPORTS).toBe(0.75);
    expect(FORUM_MAX_BUFFERED_OLDER_PAGES).toBe(2);
    expect(FORUM_SCROLL_SETTLE_DELAY).toBe(80);
    expect(FORUM_VIRTUAL_BUFFER_SIZE).toBe(400);
  });
});
