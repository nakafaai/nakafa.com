import { afterEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { useMenuWarm } from "@/components/sidebar/menu/warm";

/** The idle callbacks that the menus under test have asked the browser for. */
let idleCallbacks: readonly (() => void)[] = [];

/** Renders the warm flag as text, and hands the warm action of the menu to `onWarm`. */
function Probe({ onWarm }: { onWarm: (warm: () => void) => void }) {
  const { warm, warmed } = useMenuWarm();
  useEffect(() => {
    onWarm(warm);
  });
  return createElement("output", null, String(warmed));
}

/** Mounts the probe once its effects have run, and returns what it shows and how to unmount it. */
function mountProbe(onWarm: (warm: () => void) => void) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(createElement(Probe, { onWarm }));
  });

  return {
    shown: () => container.textContent,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** Gives the window an idle callback that records each callback it is given. */
function stubIdleCallback() {
  const requestIdleCallback = (callback: () => void) => {
    idleCallbacks = Arr.append(idleCallbacks, callback);
    return 1;
  };
  Object.defineProperty(window, "requestIdleCallback", {
    configurable: true,
    value: requestIdleCallback,
  });
  Object.defineProperty(window, "cancelIdleCallback", {
    configurable: true,
    value: () => undefined,
  });
}

describe("the warm state of a menu body", () => {
  afterEach(() => {
    idleCallbacks = [];
    Reflect.deleteProperty(window, "requestIdleCallback");
    Reflect.deleteProperty(window, "cancelIdleCallback");
  });

  it("is cold until the browser is idle, and warm once it is", () => {
    stubIdleCallback();
    const probe = mountProbe(() => undefined);

    expect(probe.shown()).toBe("false");
    act(() => {
      for (const idle of idleCallbacks) {
        idle();
      }
    });
    expect(probe.shown()).toBe("true");
    probe.unmount();
  });

  it("warms on the reader's intent, before the browser is idle", () => {
    stubIdleCallback();
    let warm: (() => void) | undefined;
    const probe = mountProbe((action) => {
      warm = action;
    });

    expect(probe.shown()).toBe("false");
    act(() => {
      warm?.();
    });
    expect(probe.shown()).toBe("true");
    probe.unmount();
  });

  it("is warm at once where the browser has no idle callback", () => {
    const probe = mountProbe(() => undefined);

    expect(probe.shown()).toBe("true");
    probe.unmount();
  });
});
