import { afterEach, describe, expect, it } from "@effect/vitest";
import { makeScrollRestoration } from "@/lib/routing/scroll";

/** Places the window as the browser left it before the router's first render. */
function placeWindow(scrollY: number) {
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    value: scrollY,
  });
}

describe("router scroll restoration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    placeWindow(0);
  });

  it("keeps a reader's own scroll through the render that hydrates the page", () => {
    placeWindow(1200);
    const restore = makeScrollRestoration();

    expect(restore()).toBe(false);
    // Every render after it follows a navigation.
    expect(restore()).toBe(true);
    expect(restore()).toBe(true);
  });

  it("restores or keeps the top when the browser left the window there", () => {
    placeWindow(0);
    const restore = makeScrollRestoration();

    expect(restore()).toBe(true);
    expect(restore()).toBe(true);
  });

  it("asks each router on its own", () => {
    placeWindow(1200);
    expect(makeScrollRestoration()()).toBe(false);
    expect(makeScrollRestoration()()).toBe(false);
  });

  it("keeps the server's inline restoration script", () => {
    vi.stubGlobal("window", undefined);
    const restore = makeScrollRestoration();

    expect(restore()).toBe(true);
    expect(restore()).toBe(true);
  });
});
