"use client";

import { QueryResult, useMutation, useQuery } from "@confect/react";
import { useNetwork } from "@mantine/hooks";
import { ANALYTICS_CONSENT_CATEGORY } from "@repo/analytics/consent";
import refs from "@repo/backend/confect/_generated/refs";
import { useConvexAuth } from "convex/react";
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
import { useViewer } from "@/lib/identity/client";

/** Owns the state that exclusively controls optional product analytics. */
export function AnalyticsConsentProvider({
  children,
  isPreviewChild,
}: {
  children: ReactNode;
  isPreviewChild: boolean;
}) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const isUserPending = useViewer((state) => state.isPending);
  const user = useViewer((state) => state.account);
  const [sessionOverrides, setSessionOverrides] =
    useState<AnalyticsConsentSessionOverrides>(() => new Map());
  const [preferences, setPreferences] = useState(initialConsentPreferences);
  const { online: isOnline } = useNetwork();
  const setAccountConsent = useMutation(refs.public.consents.current.set);
  const shouldLoadAccountConsent =
    !isPreviewChild && isAuthenticated && !isAuthLoading && !!user;
  const accountConsentQuery = useQuery(
    refs.public.consents.current.get,
    shouldLoadAccountConsent ? { category: ANALYTICS_CONSENT_CATEGORY } : "skip"
  );
  const accountConsent = QueryResult.isSuccess(accountConsentQuery)
    ? accountConsentQuery.value.decision
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
    isAccountConsentResolved: QueryResult.isSuccess(accountConsentQuery),
    isAuthenticated,
  });

  const state = resolveBrowserAnalyticsConsentState({
    accountConsent,
    browserConsent,
    isAccountConsentResolved: QueryResult.isSuccess(accountConsentQuery),
    isAuthenticated,
    isAuthLoading,
    isPreviewChild,
    isUserPending,
    user,
  });
  const hasLoadError =
    QueryResult.isFailure(accountConsentQuery) ||
    (!isAuthenticated && hasStorageError);
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
      !!user &&
      (QueryResult.isSuccess(accountConsentQuery) ||
        QueryResult.isFailure(accountConsentQuery)),
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
