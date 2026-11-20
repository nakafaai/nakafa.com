import { afterEach, describe, expect, it } from "@effect/vitest";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import {
  keepConsentAnswer,
  useAnalyticsConsent,
} from "@/lib/analytics/consent";

/** Shows the page's consent, as text the test reads. */
function ConsentProbe() {
  const consent = useAnalyticsConsent(
    ({ analytics, asks }) => `analytics=${analytics} asks=${asks}`
  );
  return createElement("span", null, consent);
}

let root: Root | undefined;

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
});

describe("the page's consent", () => {
  it("is pending until Google's message answers, then follows each answer", () => {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    root = createRoot(container);
    act(() => root?.render(createElement(ConsentProbe)));
    expect(container.textContent).toBe("analytics=pending asks=false");

    act(() => keepConsentAnswer({ analytics: false, asks: true }));
    expect(container.textContent).toBe("analytics=denied asks=true");

    act(() => keepConsentAnswer({ analytics: true, asks: true }));
    expect(container.textContent).toBe("analytics=granted asks=true");
  });
});
