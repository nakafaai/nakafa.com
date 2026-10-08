"use client";

import { QueryResult, useMutation, useQuery } from "@confect/react";
import {
  ANALYTICS_CONSENT_CATEGORY,
  type AnalyticsConsentState,
} from "@repo/analytics/consent";
import refs from "@repo/backend/confect/_generated/refs";
import { Option } from "effect";
import { useState } from "react";
import { useStore } from "zustand";
import { useConvexAuth } from "@/components/providers/convex";
import {
  createAnonymousConsentSave,
  refreshBrowserPrivacySignal,
} from "@/lib/analytics/consent/browser";
import {
  resolveConsentAffordances,
  resolveConsentError,
} from "@/lib/analytics/consent/decision";
import {
  initialConsentPreferences,
  updateConsentPreferences,
} from "@/lib/analytics/consent/preferences";
import { useAnalyticsConsentDecision } from "@/lib/analytics/consent/saves";
import {
  createAnalyticsConsentPromptIdentity,
  resolveAnalyticsConsentSessionPolicy,
} from "@/lib/analytics/consent/session";
import {
  resolveBrowserAnalyticsConsentState,
  shouldRevokeAccountAnalyticsGrant,
} from "@/lib/analytics/consent/state";
import type { AnalyticsConsentStore } from "@/lib/analytics/consent/store";
import { useViewer } from "@/lib/identity/client";

function ignoreUnavailableConsentAction() {
  // Optional analytics cannot accept a decision before its signed notice is live.
}

const unavailableAnalyticsConsentStatus: AnalyticsConsentState["status"] =
  "pending";

const unavailableAnalyticsConsent = {
  canDecline: false,
  canGrant: false,
  decide: ignoreUnavailableConsentAction,
  error: null,
  isAvailable: false,
  isPromptOpen: false,
  isSaving: false,
  preferences: initialConsentPreferences,
  setPreferencesOpen: ignoreUnavailableConsentAction,
  status: unavailableAnalyticsConsentStatus,
};

/**
 * Derives the consent state one component sees, plus the inputs the consent
 * controller's effects need.
 *
 * Every input comes from a store or a query hook, so the derivation runs in
 * each reader and no provider value changes after hydration.
 */
export function useAnalyticsConsentModel(store: AnalyticsConsentStore) {
  const mode = useStore(store, (state) => state.mode);
  const browserConsent = useStore(store, (state) => state.browserConsent);
  const hasRuntimeError = useStore(store, (state) => state.hasRuntimeError);
  const hasStorageError = useStore(store, (state) => state.hasStorageError);
  const preferences = useStore(store, (state) => state.preferences);
  const sessionOverrides = useStore(store, (state) => state.sessionOverrides);
  const setPreferences = useStore(store, (state) => state.setPreferences);
  const setSessionOverrides = useStore(
    store,
    (state) => state.setSessionOverrides
  );
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const isAuthLoading = useConvexAuth((auth) => auth.isLoading);
  const identity = useViewer((state) => state);
  const user = identity.account;
  const isPreviewChild = mode === "preview";
  const setAccountConsent = useMutation(refs.public.consents.current.set);
  const shouldLoadAccountConsent =
    mode === "live" && isAuthenticated && !isAuthLoading && !!user;
  const accountConsentQuery = useQuery(
    refs.public.consents.current.get,
    shouldLoadAccountConsent ? { category: ANALYTICS_CONSENT_CATEGORY } : "skip"
  );
  const isAccountConsentResolved = QueryResult.isSuccess(accountConsentQuery);
  const accountConsent = QueryResult.isSuccess(accountConsentQuery)
    ? accountConsentQuery.value.decision
    : null;
  // One stable Effect identity per reader, so the effects that depend on them
  // rerun only when their inputs change.
  const [currentBrowserPrivacySignal] = useState(() =>
    refreshBrowserPrivacySignal(store.getState().setBrowserConsent)
  );
  const [saveDecision] = useState(() =>
    createAnonymousConsentSave(store.getState())
  );
  const promptIdentity = createAnalyticsConsentPromptIdentity({
    isAuthenticated,
    user,
  });
  const anonymousConsent = Option.getOrNull(browserConsent.anonymousConsent);
  const durableConsent = isAuthenticated ? accountConsent : anonymousConsent;
  const state = resolveBrowserAnalyticsConsentState({
    accountConsent,
    browserConsent,
    isAccountConsentResolved,
    isAuthenticated,
    isAuthLoading,
    isPreviewChild,
    isUserPending: identity.isPending,
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
  const { canDecline, canGrant } = resolveConsentAffordances({
    hasBrowserPrivacySignal: browserConsent.hasBrowserPrivacySignal,
    isAccountResolved:
      !!user &&
      (QueryResult.isSuccess(accountConsentQuery) ||
        QueryResult.isFailure(accountConsentQuery)),
    isAnonymousResolved: browserConsent.isResolved,
    isAuthenticated,
    isBlocked: isPreviewChild || isAuthLoading || identity.isPending,
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
    useAnalyticsConsentDecision(store, {
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

  const value =
    mode === "unavailable"
      ? unavailableAnalyticsConsent
      : {
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

  return {
    accountConsent,
    browserConsent,
    currentAccountUserId: user?.appUser._id ?? null,
    currentBrowserPrivacySignal,
    durableStatus: state.status,
    interruptDepartedSave,
    isAuthenticated,
    isPreviewChild,
    isRuntimeSuppressed: sessionPolicy.isRuntimeSuppressed,
    promptIdentity,
    readLatestSave,
    setAccountConsent,
    setSessionOverrides,
    shouldRevokeAccountGrant: shouldRevokeAccountAnalyticsGrant({
      accountConsent,
      browserConsent,
      isAccountConsentResolved,
      isAuthenticated,
    }),
    user,
    value,
  };
}
