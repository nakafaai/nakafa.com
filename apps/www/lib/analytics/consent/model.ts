"use client";

import type { AnalyticsConsentState } from "@repo/analytics/consent";
import {
  resolveConsentAffordances,
  resolveConsentError,
} from "@repo/analytics/consent/decision";
import {
  initialConsentPreferences,
  updateConsentPreferences,
} from "@repo/analytics/consent/preferences";
import {
  createAnalyticsConsentPromptIdentity,
  resolveAnalyticsConsentSessionPolicy,
} from "@repo/analytics/consent/session";
import { Option } from "effect";
import { useState } from "react";
import { useStore } from "zustand";
import {
  createAnonymousConsentSave,
  refreshBrowserPrivacySignal,
} from "@/lib/analytics/consent/browser";
import { useAnalyticsConsentDecision } from "@/lib/analytics/consent/saves";
import type { saveAccountAnalyticsChoice } from "@/lib/analytics/consent/signal";
import {
  type AccountConsentDecision,
  resolveBrowserAnalyticsConsentState,
  shouldRevokeAccountAnalyticsGrant,
} from "@/lib/analytics/consent/state";
import type { AnalyticsConsentStore } from "@/lib/analytics/consent/store";
import type { AccountRecord } from "@/lib/identity/viewer";

/**
 * What the signed-in account says about optional analytics, as the consent model
 * reads it. A signed-in page reads it through the account reader, which only a
 * page with a Convex client mounts. A visitor's page reads the visitor value below,
 * so no Convex hook runs there.
 */
export interface AnalyticsConsentAccount {
  /** The account's consent query: its decision once it answers, or the failure, or nothing yet. */
  readonly accountQuery:
    | { readonly status: "pending" }
    | { readonly status: "failure" }
    | {
        readonly status: "success";
        readonly decision: AccountConsentDecision | null;
      };
  readonly isAuthenticated: boolean;
  readonly isAuthLoading: boolean;
  readonly isUserPending: boolean;
  readonly setAccountConsent: Parameters<typeof saveAccountAnalyticsChoice>[0];
  readonly user: AccountRecord | null;
}

/** The full derived consent model: its value for readers and the inputs its effects need. */
export type AnalyticsConsentModel = ReturnType<typeof useAnalyticsConsentModel>;

/** A visitor has no account, so no account answer and no account save exist. */
const visitorAccountQuery = { status: "pending" } as const;

/**
 * The account of a visitor. The account path never runs for it: nothing is
 * signed in, no account query is made, and no account save can start.
 */
export const visitorAnalyticsConsentAccount: AnalyticsConsentAccount = {
  accountQuery: visitorAccountQuery,
  isAuthLoading: false,
  isAuthenticated: false,
  isUserPending: false,
  setAccountConsent: () => {
    throw new TypeError("A visitor has no account to save a consent choice to");
  },
  user: null,
};

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
  preferences: initialConsentPreferences,
  preferencesWarm: false,
  setPreferencesOpen: ignoreUnavailableConsentAction,
  status: unavailableAnalyticsConsentStatus,
  warmPreferences: ignoreUnavailableConsentAction,
};

/**
 * Derives the consent state one component sees, from the consent store and the
 * account it is given, plus the inputs the consent controller's effects need.
 *
 * Every input comes from a store or a plain value, so the derivation runs in each
 * reader and no provider value changes after hydration. The account is read by the
 * caller: a visitor passes `visitorAnalyticsConsentAccount`, and a signed-in page
 * passes what its Convex-backed account reader derives.
 */
export function useAnalyticsConsentModel(
  store: AnalyticsConsentStore,
  account: AnalyticsConsentAccount
) {
  const mode = useStore(store, (state) => state.mode);
  const browserConsent = useStore(store, (state) => state.browserConsent);
  const hasRuntimeError = useStore(store, (state) => state.hasRuntimeError);
  const hasStorageError = useStore(store, (state) => state.hasStorageError);
  const preferences = useStore(store, (state) => state.preferences);
  const preferencesWarm = useStore(store, (state) => state.preferencesWarm);
  const sessionOverrides = useStore(store, (state) => state.sessionOverrides);
  const setPreferences = useStore(store, (state) => state.setPreferences);
  const warmPreferences = useStore(store, (state) => state.warmPreferences);
  const setSessionOverrides = useStore(
    store,
    (state) => state.setSessionOverrides
  );
  const { isAuthenticated, isAuthLoading, user, setAccountConsent } = account;
  const identity = { isPending: account.isUserPending, account: user };
  const isPreviewChild = mode === "preview";
  const isAccountConsentResolved = account.accountQuery.status === "success";
  const accountConsent =
    account.accountQuery.status === "success"
      ? account.accountQuery.decision
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
    account.accountQuery.status === "failure" ||
    (!isAuthenticated && hasStorageError);
  const sessionPolicy = resolveAnalyticsConsentSessionPolicy({
    durableConsent,
    overrides: sessionOverrides,
    promptIdentity,
    status: state.status,
  });
  const { canDecline, canGrant } = resolveConsentAffordances({
    hasBrowserPrivacySignal: browserConsent.hasBrowserPrivacySignal,
    isAccountResolved:
      !!user &&
      (account.accountQuery.status === "success" ||
        account.accountQuery.status === "failure"),
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
    if (isOpen) {
      warmPreferences();
    }
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
          preferences,
          preferencesWarm,
          setPreferencesOpen,
          status: sessionPolicy.status,
          warmPreferences,
        };

  return {
    accountConsent,
    browserConsent,
    currentAccountUserId: user?.appUser._id ?? null,
    currentBrowserPrivacySignal,
    durableStatus: state.status,
    hasLoadError,
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
