import { DEFAULT_FORUM_POST_WINDOW } from "@repo/backend/convex/classes/forums/utils/constants";
import { resolveForumPostWindow } from "@repo/backend/convex/classes/forums/utils/windowing";
import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";

describe("classes/forums/utils/windowing", () => {
  it("uses the default forum post window when no explicit limit is provided", () => {
    expect(resolveForumPostWindow(undefined)).toBe(DEFAULT_FORUM_POST_WINDOW);
  });

  it("returns an explicit integer limit inside the supported range", () => {
    expect(resolveForumPostWindow(25)).toBe(25);
  });

  it("rejects non-integer public window sizes", () => {
    expect(() => resolveForumPostWindow(2.5)).toThrow(ConvexError);
  });

  it("rejects out-of-range public window sizes", () => {
    expect(() => resolveForumPostWindow(0)).toThrow(ConvexError);
    expect(() => resolveForumPostWindow(51)).toThrow(ConvexError);
  });
});
