"use client";

import { useNetwork } from "@mantine/hooks";
import { ANALYTICS_CONSENT_ROOT_ATTRIBUTE } from "@repo/analytics/consent";
import { Effect } from "effect";
import { type ReactNode, useEffect, useLayoutEffect, useState } from "react";
import { useStore } from "zustand";
import { markAnalyticsConsentRoot } from "@/lib/analytics/consent/bootstrap";
import {
  readNavigatorPrivacySignal,
  useAnonymousDenialPersistence,
  useBrowserConsentSync,
} from "@/lib/analytics/consent/browser";
import {
  AnalyticsConsentContext,
  useAnalyticsConsentStore,
} from "@/lib/analytics/consent/context";
import type { AnalyticsConsentModel } from "@/lib/analytics/consent/model";
import { useAccountAnalyticsConsentRevocation } from "@/lib/analytics/consent/revocation";
import { useAnalyticsRuntimeAlignment } from "@/lib/analytics/consent/runtime";
import { createAnalyticsConsentStore } from "@/lib/analytics/consent/store";
import {
  clearContentViewDevice,
  isContentViewDeviceRetained,
} from "@/lib/content/views/device";

/**
 * Owns the state that exclusively controls optional product analytics.
 *
 * The context carries only the consent store, so its value never changes
 * after hydration. Readers derive the consent state from the store and the
 * account they are given, and the effects run in the controller that the page
 * mounts for its account: a visitor's or a signed-in page's.
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
    <AnalyticsConsentContext value={store}>{children}</AnalyticsConsentContext>
  );
}

/**
 * Keeps the browser consent, the analytics runtime, the content-view
 * identifier, and account revocations aligned with the derived consent state.
 */
export function AnalyticsConsentEffects({
  consent,
}: {
  consent: AnalyticsConsentModel;
}) {
  const store = useAnalyticsConsentStore();
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
  const { durableStatus, hasLoadError, interruptDepartedSave, promptIdentity } =
    consent;

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

  // The inline script marks a page the server rendered. A page that mounts here
  // without it, such as the first app page a soft navigation opens, takes the same
  // mark before paint, so the prompt cannot paint before the store knows the visitor.
  useLayoutEffect(() => {
    Effect.runSync(
      markAnalyticsConsentRoot(
        document.documentElement,
        readNavigatorPrivacySignal()
      )
    );
  }, []);

  // The mark holds the prompt until the store knows the choice, or knows that it
  // cannot load it. Then only the prompt's own state decides, and the mark goes, so
  // a later sign-out or a soft navigation shows the prompt. A load error must not
  // stay hidden, because the prompt is where it shows. This keeps the DOM in step
  // with the store, so it is an effect.
  useEffect(() => {
    if (durableStatus === "pending" && !hasLoadError) {
      return;
    }
    document.documentElement.removeAttribute(ANALYTICS_CONSENT_ROOT_ATTRIBUTE);
  }, [durableStatus, hasLoadError]);

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
