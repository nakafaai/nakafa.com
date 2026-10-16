"use client";

import { useNetwork } from "@mantine/hooks";
import { ANALYTICS_CONSENT_ROOT_ATTRIBUTE } from "@repo/analytics/consent";
import { Effect } from "effect";
import { type ReactNode, useEffect, useState } from "react";
import { useStore } from "zustand";
import { useAuthSession } from "@/components/auth/session";
import {
  useAccountPromptChoiceMarker,
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
  const sessionId = useAuthSession((session) => session.sessionId);

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
  useAccountPromptChoiceMarker({
    accountConsent: consent.accountConsent,
    isAuthenticated: consent.isAuthenticated,
    sessionId,
  });

  // The bootstrap marks the root before the app loads, so the prompt is hidden
  // until the store knows the choice. Once it does, only the prompt's own state
  // decides, and the mark goes, so a later sign-out or a soft navigation shows
  // the prompt. This keeps the DOM in step with the store, so it is an effect.
  useEffect(() => {
    if (durableStatus === "pending") {
      return;
    }
    document.documentElement.removeAttribute(ANALYTICS_CONSENT_ROOT_ATTRIBUTE);
  }, [durableStatus]);

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

  useAnalyticsRuntimeAlignment({
    accountConsent: consent.accountConsent,
    anonymousConsent: consent.browserConsent.anonymousConsent,
    isAuthenticated: consent.isAuthenticated,
    isPreviewChild: consent.isPreviewChild,
    isRuntimeSuppressed: consent.isRuntimeSuppressed,
    setHasRuntimeError,
    status: durableStatus,
    user: consent.user,
  });

  useEffect(() => {
    if (!promptIdentity) {
      return;
    }

    const departedIdentity = promptIdentity;
    return () => {
      interruptDepartedSave(departedIdentity);
    };
  }, [interruptDepartedSave, promptIdentity]);

  useAccountAnalyticsConsentRevocation({
    currentAccountUserId: consent.currentAccountUserId,
    currentBrowserPrivacySignal: consent.currentBrowserPrivacySignal,
    isOnline,
    promptIdentity,
    readLatestSave: consent.readLatestSave,
    setAccountConsent: consent.setAccountConsent,
    setSessionOverrides: consent.setSessionOverrides,
    shouldRevokeAccountGrant: consent.shouldRevokeAccountGrant,
  });

  return null;
}
