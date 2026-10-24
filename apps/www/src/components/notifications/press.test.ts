import { describe, expect, it } from "@effect/vitest";
import { navigationOf } from "@/components/notifications/press";

/** A press with the primary button and no modifier key, which is a plain click. */
const plain = {
  altKey: false,
  button: 0,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
};

describe("inbox row navigation", () => {
  it("keeps a plain press in the same tab", () => {
    expect(navigationOf(plain)).toBe("same-tab");
  });

  it.each([
    ["alt", { altKey: true }],
    ["control", { ctrlKey: true }],
    ["command", { metaKey: true }],
    ["shift", { shiftKey: true }],
  ])("leaves a press with the %s key held to the browser", (_key, modifier) => {
    expect(navigationOf({ ...plain, ...modifier })).toBe("browser");
  });

  it.each([
    ["middle", 1],
    ["secondary", 2],
  ])("leaves a press of the %s button to the browser", (_name, button) => {
    expect(navigationOf({ ...plain, button })).toBe("browser");
  });
});
