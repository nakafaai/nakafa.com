import { afterEach, describe, expect, it } from "@effect/vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { useReachedPage } from "@/components/marketing/about/toys/reach";

/** Renders the flag that the hook returns as text, so a test reads what the page shows. */
function Probe() {
  return createElement("output", null, String(useReachedPage()));
}

/** Sets the vertical scroll offset of the window, as an earlier scroll leaves it. */
function setScrollY(value: number) {
  Object.defineProperty(window, "scrollY", { configurable: true, value });
}

/** Mounts the probe once its effects have run, and returns what it shows and how to unmount it. */
function mountProbe() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(createElement(Probe));
  });

  return {
    shown: () => container.textContent,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** Dispatches one browser event on the window inside React's act boundary. */
function dispatch(type: string) {
  act(() => {
    window.dispatchEvent(new Event(type));
  });
}

describe("the reached flag of the home toys", () => {
  afterEach(() => {
    setScrollY(0);
  });

  it("is false before the reader acts on the page", () => {
    const probe = mountProbe();

    expect(probe.shown()).toBe("false");
    probe.unmount();
  });

  it("is true when a scroll came before the page attached its listeners", () => {
    setScrollY(480);
    const probe = mountProbe();

    expect(probe.shown()).toBe("true");
    probe.unmount();
  });

  it("becomes true at the first scroll after the page attached its listeners", () => {
    const probe = mountProbe();
    expect(probe.shown()).toBe("false");

    dispatch("scroll");

    expect(probe.shown()).toBe("true");
    probe.unmount();
  });

  it("stays true when the reader scrolls back to the top", () => {
    const probe = mountProbe();
    setScrollY(480);
    dispatch("scroll");
    expect(probe.shown()).toBe("true");

    setScrollY(0);
    dispatch("scroll");

    expect(probe.shown()).toBe("true");
    probe.unmount();
  });

  it("renders the server HTML at the top of the page, whatever offset the window has", () => {
    setScrollY(480);

    expect(renderToString(createElement(Probe))).toBe("<output>false</output>");
  });

  it("becomes true at a pointer movement or a touch", () => {
    const pointer = mountProbe();
    dispatch("pointermove");
    expect(pointer.shown()).toBe("true");
    pointer.unmount();

    const touch = mountProbe();
    dispatch("touchstart");
    expect(touch.shown()).toBe("true");
    touch.unmount();
  });
});
