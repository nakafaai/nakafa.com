import { afterEach, describe, expect, it } from "@effect/vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  type AnalyticsConsent,
  keepConsentAnswer,
  useAnalyticsConsent,
} from "@/lib/analytics/consent";

/** What the reading component saw on its last render. */
let seen: AnalyticsConsent | undefined;

function Reader() {
  seen = useAnalyticsConsent((consent) => consent);
  return null;
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
    act(() => root?.render(createElement(Reader)));
    expect(seen).toEqual({ analytics: "pending", asks: false });

    act(() => keepConsentAnswer({ analytics: false, asks: true }));
    expect(seen).toEqual({ analytics: "denied", asks: true });

    act(() => keepConsentAnswer({ analytics: true, asks: true }));
    expect(seen).toEqual({ analytics: "granted", asks: true });
  });
});
