"use client";

import { useNetwork } from "@mantine/hooks";
import { ANALYTICS_CONSENT_CATEGORY } from "@repo/analytics/consent";
import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { useConvexAuth, useMutation } from "convex/react";
import { Option } from "effect";
import { type ReactNode, useEffect, useState } from "react";
import { useAnonymousAnalyticsConsent } from "@/lib/analytics/consent/browser";
import { AnalyticsConsentContext } from "@/lib/analytics/consent/context";
import {
  resolveConsentAffordances,
  resolveConsentError,
} from "@/lib/analytics/consent/decision";
import {
  initialConsentPreferences,
  updateConsentPreferences,
} from "@/lib/analytics/consent/preferences";
import { useAccountAnalyticsConsentRevocation } from "@/lib/analytics/consent/revocation";
import { useAnalyticsRuntimeAlignment } from "@/lib/analytics/consent/runtime";
import { useAnalyticsConsentDecision } from "@/lib/analytics/consent/saves";
import {
  type AnalyticsConsentSessionOverrides,
  createAnalyticsConsentPromptIdentity,
  resolveAnalyticsConsentSessionPolicy,
} from "@/lib/analytics/consent/session";
import {
  resolveBrowserAnalyticsConsentState,
  shouldRevokeAccountAnalyticsGrant,
} from "@/lib/analytics/consent/state";
import { useUser } from "@/lib/context/use-user";

/** Owns the state that exclusively controls optional product analytics. */
export function AnalyticsConsentProvider({
  children,
  isPreviewChild,
}: {
  children: ReactNode;
  isPreviewChild: boolean;
}) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const { isPending: isUserPending, user } = useUser((state) => ({
    isPending: state.isPending,
    user: state.user,
  }));
  const [sessionOverrides, setSessionOverrides] =
    useState<AnalyticsConsentSessionOverrides>(() => new Map());
  const [preferences, setPreferences] = useState(initialConsentPreferences);
  const { online: isOnline } = useNetwork();
  const setAccountConsent = useMutation(api.consents.current.set);
  const shouldLoadAccountConsent =
    !isPreviewChild && isAuthenticated && !isAuthLoading && !!user;
  const accountConsentQuery = useQueryWithStatus(
    api.consents.current.get,
    shouldLoadAccountConsent ? { category: ANALYTICS_CONSENT_CATEGORY } : "skip"
  );
  const accountConsent = accountConsentQuery.isSuccess
    ? accountConsentQuery.data.decision
    : null;
  const {
    browserConsent,
    currentBrowserPrivacySignal,
    hasStorageError,
    saveDecision,
  } = useAnonymousAnalyticsConsent({
    accountConsent,
    isAuthenticated,
    isPreviewChild,
  });
  const promptIdentity = createAnalyticsConsentPromptIdentity({
    isAuthenticated,
    user,
  });
  const anonymousConsent = Option.getOrNull(browserConsent.anonymousConsent);
  const durableConsent = isAuthenticated ? accountConsent : anonymousConsent;
  const currentAccountUserId = user?.appUser._id ?? null;
  const shouldRevokeAccountGrant = shouldRevokeAccountAnalyticsGrant({
    accountConsent,
    browserConsent,
    isAccountConsentResolved: accountConsentQuery.isSuccess,
    isAuthenticated,
  });

  const state = resolveBrowserAnalyticsConsentState({
    accountConsent,
    browserConsent,
    isAccountConsentResolved: accountConsentQuery.isSuccess,
    isAuthenticated,
    isAuthLoading,
    isPreviewChild,
    isUserPending,
    user,
  });
  const hasLoadError =
    accountConsentQuery.isError || (!isAuthenticated && hasStorageError);
  const sessionPolicy = resolveAnalyticsConsentSessionPolicy({
    durableConsent,
    hasLoadError,
    overrides: sessionOverrides,
    promptIdentity,
    status: state.status,
  });
  const hasRuntimeError = useAnalyticsRuntimeAlignment({
    accountConsent,
    anonymousConsent: browserConsent.anonymousConsent,
    isAuthenticated,
    isPreviewChild,
    isRuntimeSuppressed: sessionPolicy.isRuntimeSuppressed,
    status: state.status,
    user,
  });

  const { canDecline, canGrant } = resolveConsentAffordances({
    hasBrowserPrivacySignal: browserConsent.hasBrowserPrivacySignal,
    isAccountResolved:
      !!user && (accountConsentQuery.isSuccess || accountConsentQuery.isError),
    isAnonymousResolved: browserConsent.isResolved,
    isAuthenticated,
    isBlocked: isPreviewChild || isAuthLoading || isUserPending,
  });
  const error = resolveConsentError({
    hasLoadError,
    hasRuntimeError,
    hasSaveError: sessionPolicy.hasSaveError,
  });

  function setPreferencesOpen(isOpen: boolean) {
    setPreferences((current) =>
      updateConsentPreferences({
        current,
        isOpen,
        status: sessionPolicy.status,
      })
    );
  }

  const { decide, interruptDepartedSave, readLatestSave } =
    useAnalyticsConsentDecision({
      canDecline,
      canGrant,
      currentBrowserPrivacySignal,
      isAuthenticated,
      isSaving: sessionPolicy.isSaving,
      promptIdentity,
      saveDecision,
      setAccountConsent,
      setPreferencesOpen,
      setSessionOverrides,
      user,
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
    currentAccountUserId,
    currentBrowserPrivacySignal,
    isOnline,
    promptIdentity,
    readLatestSave,
    setAccountConsent,
    setSessionOverrides,
    shouldRevokeAccountGrant,
  });

  const contextValue = {
    canDecline,
    canGrant,
    decide,
    error,
    isAvailable: !isPreviewChild,
    isPromptOpen: sessionPolicy.isPromptOpen,
    isSaving: sessionPolicy.isSaving,
    preferences,
    setPreferencesOpen,
    status: sessionPolicy.status,
  };

  return (
    <AnalyticsConsentContext.Provider value={contextValue}>
      {children}
    </AnalyticsConsentContext.Provider>
  );
}
