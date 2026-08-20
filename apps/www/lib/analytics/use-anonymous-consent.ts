"use client";

import {
  ANALYTICS_BROWSER_SIGNAL_MECHANISM,
  ANALYTICS_CONSENT_MECHANISM,
  ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
  createAnonymousAnalyticsBrowserSignalDenial,
  createAnonymousAnalyticsConsent,
  hasBrowserPrivacySignal,
} from "@repo/analytics/consent";
import { Clock, Effect, Fiber, Option } from "effect";
import { useEffect, useState } from "react";
import {
  type AccountConsentDecision,
  type BrowserConsentSnapshot,
  shouldPersistAnonymousAnalyticsDenial,
} from "@/lib/analytics/consent-state";
import {
  loadAnonymousAnalyticsConsent,
  saveAnonymousAnalyticsConsent,
} from "@/lib/analytics/consent-storage";

/** Owns the browser-local source, privacy signal, and cross-tab consent state. */
export function useAnonymousAnalyticsConsent({
  accountConsent,
  isAuthenticated,
  isPreviewChild,
}: {
  readonly accountConsent: AccountConsentDecision | null;
  readonly isAuthenticated: boolean;
  readonly isPreviewChild: boolean;
}) {
  const [browserConsent, setBrowserConsent] = useState<BrowserConsentSnapshot>(
    () => ({
      anonymousConsent: Option.none(),
      hasBrowserPrivacySignal: false,
      isResolved: isPreviewChild,
    })
  );
  const [hasStorageError, setHasStorageError] = useState(false);

  useEffect(() => {
    if (isPreviewChild) {
      return;
    }

    const globalPrivacyControl =
      "globalPrivacyControl" in navigator
        ? navigator.globalPrivacyControl
        : undefined;
    const browserPrivacySignal = hasBrowserPrivacySignal({
      doNotTrack: [navigator.doNotTrack],
      globalPrivacyControl,
    });
    let isMounted = true;
    const loadBrowserConsent = () =>
      Effect.runFork(
        loadAnonymousAnalyticsConsent().pipe(
          Effect.matchEffect({
            onFailure: () =>
              Effect.sync(() => {
                if (!isMounted) {
                  return;
                }

                setBrowserConsent({
                  anonymousConsent: Option.none(),
                  hasBrowserPrivacySignal: browserPrivacySignal,
                  isResolved: true,
                });
                setHasStorageError(true);
              }),
            onSuccess: (anonymousConsent) =>
              Effect.sync(() => {
                if (!isMounted) {
                  return;
                }

                setBrowserConsent({
                  anonymousConsent,
                  hasBrowserPrivacySignal: browserPrivacySignal,
                  isResolved: true,
                });
                setHasStorageError(false);
              }),
          })
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
    window.addEventListener("storage", handleStorage);

    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleStorage);
      Effect.runFork(Fiber.interrupt(loadFiber));
    };
  }, [isPreviewChild]);

  const shouldPersistDenial = shouldPersistAnonymousAnalyticsDenial({
    accountConsent,
    browserConsent,
    isAuthenticated,
  });

  useEffect(() => {
    if (!shouldPersistDenial) {
      return;
    }

    const mechanism = browserConsent.hasBrowserPrivacySignal
      ? ANALYTICS_BROWSER_SIGNAL_MECHANISM
      : ANALYTICS_CONSENT_MECHANISM;
    const denialFiber = Effect.runFork(
      Clock.currentTimeMillis.pipe(
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
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(denialFiber));
    };
  }, [browserConsent.hasBrowserPrivacySignal, shouldPersistDenial]);

  const saveDecision = (granted: boolean) =>
    Clock.currentTimeMillis.pipe(
      Effect.map((decidedAt) =>
        createAnonymousAnalyticsConsent(
          granted ? "granted" : "denied",
          decidedAt
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
      ),
      Effect.asVoid
    );

  return {
    browserConsent,
    hasStorageError,
    saveDecision,
  };
}
