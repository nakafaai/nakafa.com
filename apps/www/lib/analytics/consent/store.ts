import {
  type AnalyticsConsentPreferences,
  initialConsentPreferences,
} from "@repo/analytics/consent/preferences";
import {
  type AnalyticsConsentSessionOverrides,
  emptyAnalyticsConsentSessionOverrides,
} from "@repo/analytics/consent/session";
import { Option, Schema } from "effect";
import { createStore } from "zustand";
import { combine } from "zustand/middleware";
import type { AnalyticsConsentSave } from "@/lib/analytics/consent/decision";
import type { BrowserConsentSnapshot } from "@/lib/analytics/consent/state";

/**
 * Where optional analytics can be decided: on the live site, inside an
 * isolated authoring preview that never asks, or on a page whose signed
 * notice is not live yet.
 */
export const AnalyticsConsentMode = Schema.Literals([
  "live",
  "preview",
  "unavailable",
]);

export type AnalyticsConsentMode = typeof AnalyticsConsentMode.Type;

/**
 * Creates one provider's consent store with the state the server renders.
 *
 * It holds the consent state that only the controller's own actions and the
 * browser write. Keeping it in a store lets the provider's context value stay
 * the same after hydration, because React discards streamed Suspense
 * boundaries that are still pending when an ancestor context changes; readers
 * derive the public consent state from it with `useAnalyticsConsent`.
 */
export function createAnalyticsConsentStore(mode: AnalyticsConsentMode) {
  const browserConsent: BrowserConsentSnapshot = {
    anonymousConsent: Option.none(),
    hasBrowserPrivacySignal: false,
    isResolved: mode === "preview",
  };
  return createStore(
    combine(
      {
        browserConsent,
        hasRuntimeError: false,
        hasStorageError: false,
        latestSave: Option.none<AnalyticsConsentSave>(),
        mode,
        preferences: initialConsentPreferences,
        sessionOverrides: emptyAnalyticsConsentSessionOverrides,
      },
      (set) => ({
        setBrowserConsent: (
          update: (current: BrowserConsentSnapshot) => BrowserConsentSnapshot
        ) => set((state) => ({ browserConsent: update(state.browserConsent) })),
        setHasRuntimeError: (hasRuntimeError: boolean) =>
          set({ hasRuntimeError }),
        setHasStorageError: (hasStorageError: boolean) =>
          set({ hasStorageError }),
        setLatestSave: (latestSave: Option.Option<AnalyticsConsentSave>) =>
          set({ latestSave }),
        setPreferences: (
          update: (
            current: AnalyticsConsentPreferences
          ) => AnalyticsConsentPreferences
        ) => set((state) => ({ preferences: update(state.preferences) })),
        setSessionOverrides: (
          update: (
            current: AnalyticsConsentSessionOverrides
          ) => AnalyticsConsentSessionOverrides
        ) =>
          set((state) => ({
            sessionOverrides: update(state.sessionOverrides),
          })),
      })
    )
  );
}

export type AnalyticsConsentStore = ReturnType<
  typeof createAnalyticsConsentStore
>;

export type AnalyticsConsentStoreState = ReturnType<
  AnalyticsConsentStore["getState"]
>;
