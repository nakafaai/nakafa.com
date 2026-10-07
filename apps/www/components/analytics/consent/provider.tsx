"use client";

import { useNetwork } from "@mantine/hooks";
import { Effect } from "effect";
import { type ReactNode, useEffect, useState } from "react";
import { useStore } from "zustand";
import {
  useAnonymousDenialPersistence,
  useBrowserConsentSync,
} from "@/lib/analytics/consent/browser";
import { AnalyticsConsentContext } from "@/lib/analytics/consent/context";
import { useAnalyticsConsentModel } from "@/lib/analytics/consent/model";
import { useAccountAnalyticsConsentRevocation } from "@/lib/analytics/consent/revocation";
import { useAnalyticsRuntimeAlignment } from "@/lib/analytics/consent/runtime";
import {
  type AnalyticsConsentStore,
  createAnalyticsConsentStore,
} from "@/lib/analytics/consent/store";
import {
  clearContentViewDevice,
  isContentViewDeviceRetained,
} from "@/lib/content/views/device";

/**
 * Owns the state that exclusively controls optional product analytics.
 *
 * The context carries only the consent store, so its value never changes
 * after hydration; readers derive the consent state with
 * `useAnalyticsConsent`, and the controller below runs the effects once.
 */
export function AnalyticsConsentProvider({
  children,
  isPreviewChild,
}: {
  children: ReactNode;
  isPreviewChild: boolean;
}) {
  const [store] = useState(() =>
    createAnalyticsConsentStore(isPreviewChild ? "preview" : "live")
  );

  return (
    <AnalyticsConsentContext value={store}>
      {children}
      <AnalyticsConsentController store={store} />
    </AnalyticsConsentContext>
  );
}

/**
 * Keeps the browser consent, the analytics runtime, the content-view
 * identifier, and account revocations aligned with the derived consent state.
 */
function AnalyticsConsentController({
  store,
}: {
  store: AnalyticsConsentStore;
}) {
  const consent = useAnalyticsConsentModel(store);
  const setBrowserConsent = useStore(store, (state) => state.setBrowserConsent);
  const setHasRuntimeError = useStore(
    store,
    (state) => state.setHasRuntimeError
  );
  const setHasStorageError = useStore(
    store,
    (state) => state.setHasStorageError
  );
  const { online: isOnline } = useNetwork();
  const { durableStatus, interruptDepartedSave, promptIdentity } = consent;

  useBrowserConsentSync({
    isPreviewChild: consent.isPreviewChild,
    setBrowserConsent,
    setHasStorageError,
  });
  useAnonymousDenialPersistence({
    accountConsent: consent.accountConsent,
    browserConsent: consent.browserConsent,
    isAuthenticated: consent.isAuthenticated,
    setBrowserConsent,
    setHasStorageError,
  });

  // The content-view identifier exists only under a durable grant; reading the
  // durable status keeps it while a repeated choice is still saving.
  useEffect(() => {
    if (isContentViewDeviceRetained(durableStatus)) {
      return;
    }
    Effect.runFork(
      clearContentViewDevice().pipe(
        // Blocked storage holds no identifier to remove.
        Effect.catchTag("ContentViewDeviceStorageFailed", () => Effect.void)
      )
    );
  }, [durableStatus]);

  useAnalyticsRuntimeAlignment(consent, setHasRuntimeError);

  useEffect(() => {
    if (!promptIdentity) {
      return;
    }

    const departedIdentity = promptIdentity;
    return () => {
      interruptDepartedSave(departedIdentity);
    };
  }, [interruptDepartedSave, promptIdentity]);

  useAccountAnalyticsConsentRevocation(consent, isOnline);

  return null;
}
