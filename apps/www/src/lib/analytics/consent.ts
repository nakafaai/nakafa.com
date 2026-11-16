import { Schema } from "effect";
import { createStore, useStore } from "zustand";
import type { ConsentAnswer } from "@/lib/ads/consent";

/**
 * What the page knows of a visitor's consent, which Google's consent message
 * alone decides (consent mode): whether analytics may store on the device, still
 * pending until the message answers, and whether the message asks this visitor
 * at all, as it does where a privacy law applies.
 */
export const AnalyticsConsent = Schema.Struct({
  analytics: Schema.Literals(["denied", "granted", "pending"]),
  asks: Schema.Boolean,
});
export type AnalyticsConsent = typeof AnalyticsConsent.Type;

const consentStore = createStore<AnalyticsConsent>(() => ({
  analytics: "pending",
  asks: false,
}));

/** Keeps an answer of Google's consent message as the page's consent. */
export function keepConsentAnswer(answer: ConsentAnswer) {
  consentStore.setState({
    analytics: answer.analytics ? "granted" : "denied",
    asks: answer.asks,
  });
}

/** Reads the page's consent through `select`, and renders again when the part it reads changes. */
export function useAnalyticsConsent<T>(
  select: (consent: AnalyticsConsent) => T
): T {
  return useStore(consentStore, select);
}
