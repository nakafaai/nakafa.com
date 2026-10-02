"use client";

import {
  ANALYTICS_BROWSER_SIGNAL_MECHANISM,
  ANALYTICS_CONSENT_MECHANISM,
  ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
  createAnonymousAnalyticsBrowserSignalDenial,
  createAnonymousAnalyticsConsent,
} from "@repo/analytics/consent";
import { Clock, Effect, Fiber, Option } from "effect";
import { useEffect } from "react";
import {
  type BrowserPrivacySignalSource,
  readBrowserPrivacySignal,
} from "@/lib/analytics/consent/signal";
import {
  type AccountConsentDecision,
  type BrowserConsentSnapshot,
  shouldPersistAnonymousAnalyticsDenial,
} from "@/lib/analytics/consent/state";
import {
  loadAnonymousAnalyticsConsent,
  saveAnonymousAnalyticsConsent,
} from "@/lib/analytics/consent/storage";
import type { AnalyticsConsentStoreState } from "@/lib/analytics/consent/store";

const navigatorPrivacySignalSource = {
  read() {
    let globalPrivacyControl: unknown;
    if ("globalPrivacyControl" in navigator) {
      globalPrivacyControl = navigator.globalPrivacyControl;
    }

    return {
      doNotTrack: navigator.doNotTrack,
      globalPrivacyControl,
    };
  },
} satisfies BrowserPrivacySignalSource;

const browserPrivacySignal = readBrowserPrivacySignal(
  navigatorPrivacySignalSource
);

type SetBrowserConsent = AnalyticsConsentStoreState["setBrowserConsent"];
type SetHasStorageError = AnalyticsConsentStoreState["setHasStorageError"];

/** Rereads the browser privacy signal into the consent store and returns it. */
export function refreshBrowserPrivacySignal(
  setBrowserConsent: SetBrowserConsent
) {
  return browserPrivacySignal.pipe(
    Effect.tap((hasBrowserPrivacySignal) =>
      Effect.sync(() =>
        setBrowserConsent((current) => {
          if (current.hasBrowserPrivacySignal === hasBrowserPrivacySignal) {
            return current;
          }

          return { ...current, hasBrowserPrivacySignal };
        })
      )
    )
  );
}

/**
 * Builds the anonymous save for one consent store: a browser privacy signal
 * always stores a denial, otherwise the visitor's choice is stored.
 */
export function createAnonymousConsentSave({
  setBrowserConsent,
  setHasStorageError,
}: {
  readonly setBrowserConsent: SetBrowserConsent;
  readonly setHasStorageError: SetHasStorageError;
}) {
  return (granted: boolean) =>
    refreshBrowserPrivacySignal(setBrowserConsent).pipe(
      Effect.flatMap((hasBrowserPrivacySignal) =>
        Clock.currentTimeMillis.pipe(
          Effect.map((decidedAt) =>
            hasBrowserPrivacySignal
              ? createAnonymousAnalyticsBrowserSignalDenial(decidedAt)
              : createAnonymousAnalyticsConsent(
                  granted ? "granted" : "denied",
                  decidedAt
                )
          )
        )
      ),
      Effect.tap(saveAnonymousAnalyticsConsent),
      Effect.tap((consent) =>
        Effect.sync(() => {
          setBrowserConsent((current) => ({
            ...current,
            anonymousConsent: Option.some(consent),
          }));
          setHasStorageError(false);
        })
      )
    );
}

/**
 * Loads the browser-local consent and privacy signal into the consent store
 * and reloads them when another tab or a restored page may have changed them.
 */
export function useBrowserConsentSync({
  isPreviewChild,
  setBrowserConsent,
  setHasStorageError,
}: {
  readonly isPreviewChild: boolean;
  readonly setBrowserConsent: SetBrowserConsent;
  readonly setHasStorageError: SetHasStorageError;
}) {
  useEffect(() => {
    if (isPreviewChild) {
      return;
    }

    let isMounted = true;
    const loadBrowserConsent = () =>
      Effect.runFork(
        readBrowserPrivacySignal(navigatorPrivacySignalSource).pipe(
          Effect.flatMap((hasBrowserPrivacySignal) =>
            loadAnonymousAnalyticsConsent().pipe(
              Effect.matchEffect({
                onFailure: () =>
                  Effect.sync(() => {
                    if (!isMounted) {
                      return;
                    }

                    setBrowserConsent(() => ({
                      anonymousConsent: Option.none(),
                      hasBrowserPrivacySignal,
                      isResolved: true,
                    }));
                    setHasStorageError(true);
                  }),
                onSuccess: (anonymousConsent) =>
                  Effect.sync(() => {
                    if (!isMounted) {
                      return;
                    }

                    setBrowserConsent(() => ({
                      anonymousConsent,
                      hasBrowserPrivacySignal,
                      isResolved: true,
                    }));
                    setHasStorageError(false);
                  }),
              })
            )
          )
        )
      );
    const loadFiber = loadBrowserConsent();
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key !== null &&
        event.key !== ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY
      ) {
        return;
      }

      loadBrowserConsent();
    };
    const handlePageShow = () => {
      loadBrowserConsent();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadBrowserConsent();
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      Effect.runFork(Fiber.interrupt(loadFiber));
    };
  }, [isPreviewChild, setBrowserConsent, setHasStorageError]);
}

/**
 * Stores the anonymous denial a browser privacy signal requires, so the
 * decision survives the signal being turned off later.
 */
export function useAnonymousDenialPersistence({
  accountConsent,
  browserConsent,
  isAuthenticated,
  setBrowserConsent,
  setHasStorageError,
}: {
  readonly accountConsent: AccountConsentDecision | null;
  readonly browserConsent: BrowserConsentSnapshot;
  readonly isAuthenticated: boolean;
  readonly setBrowserConsent: SetBrowserConsent;
  readonly setHasStorageError: SetHasStorageError;
}) {
  const shouldPersistDenial = shouldPersistAnonymousAnalyticsDenial({
    accountConsent,
    browserConsent,
    isAuthenticated,
  });

  useEffect(() => {
    if (!shouldPersistDenial) {
      return;
    }

    const denialFiber = Effect.runFork(
      refreshBrowserPrivacySignal(setBrowserConsent).pipe(
        Effect.flatMap((hasBrowserPrivacySignal) => {
          const currentBrowserConsent = {
            ...browserConsent,
            hasBrowserPrivacySignal,
          };
          const shouldPersistCurrentDenial =
            shouldPersistAnonymousAnalyticsDenial({
              accountConsent,
              browserConsent: currentBrowserConsent,
              isAuthenticated,
            });
          if (!shouldPersistCurrentDenial) {
            return Effect.void;
          }

          const mechanism = hasBrowserPrivacySignal
            ? ANALYTICS_BROWSER_SIGNAL_MECHANISM
            : ANALYTICS_CONSENT_MECHANISM;
          return Clock.currentTimeMillis.pipe(
            Effect.map((decidedAt) =>
              mechanism === ANALYTICS_BROWSER_SIGNAL_MECHANISM
                ? createAnonymousAnalyticsBrowserSignalDenial(decidedAt)
                : createAnonymousAnalyticsConsent("denied", decidedAt)
            ),
            Effect.tap(saveAnonymousAnalyticsConsent),
            Effect.matchEffect({
              onFailure: () => Effect.sync(() => setHasStorageError(true)),
              onSuccess: (consent) =>
                Effect.sync(() => {
                  setBrowserConsent((current) => ({
                    ...current,
                    anonymousConsent: Option.some(consent),
                  }));
                  setHasStorageError(false);
                }),
            })
          );
        })
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(denialFiber));
    };
  }, [
    accountConsent,
    browserConsent,
    isAuthenticated,
    setBrowserConsent,
    setHasStorageError,
    shouldPersistDenial,
  ]);
}
