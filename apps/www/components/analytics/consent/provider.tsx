"use client";

import { useNetwork } from "@mantine/hooks";
import {
  ANALYTICS_CONSENT_CATEGORY,
  ANALYTICS_CONSENT_MECHANISM,
  ANALYTICS_CONSENT_NOTICE_VERSION,
} from "@repo/analytics/consent";
import {
  disableBrowserAnalytics,
  enableBrowserAnalytics,
  synchronizeBrowserAnalyticsIdentity,
} from "@repo/analytics/posthog/browser";
import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { useConvexAuth, useMutation } from "convex/react";
import { Effect, Fiber } from "effect";
import { type ReactNode, useEffect, useState, useTransition } from "react";
import { env } from "@/env";
import { useAnonymousAnalyticsConsent } from "@/lib/analytics/consent/browser";
import {
  AnalyticsConsentContext,
  type AnalyticsConsentError,
} from "@/lib/analytics/consent/context";
import { revokeAccountAnalyticsGrant } from "@/lib/analytics/consent/signal";
import {
  type AnalyticsConsentSessionOverrides,
  clearAnalyticsConsentSessionOverride,
  createAnalyticsConsentPromptIdentity,
  createBrowserAnalyticsIdentity,
  resolveAnalyticsConsentSessionPolicy,
  resolveBrowserAnalyticsConsentState,
  setAnalyticsConsentSessionOverride,
  shouldRevokeAccountAnalyticsGrant,
} from "@/lib/analytics/consent/state";
import { useUser } from "@/lib/context/use-user";

const isPreviewChild = env.NEXT_PUBLIC_AKSARA_PREVIEW_CHILD === "true";

/** Owns the state that exclusively controls optional product analytics. */
export function AnalyticsConsentProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const { isPending: isUserPending, user } = useUser((state) => ({
    isPending: state.isPending,
    user: state.user,
  }));
  const [hasRuntimeError, setRuntimeError] = useState(false);
  const [sessionOverrides, setSessionOverrides] =
    useState<AnalyticsConsentSessionOverrides>(() => new Map());
  const [isPreferencesOpen, setPreferencesOpen] = useState(false);
  const [, startSaving] = useTransition();
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
  const { browserConsent, hasStorageError, saveDecision } =
    useAnonymousAnalyticsConsent({
      accountConsent,
      isAuthenticated,
      isPreviewChild,
    });
  const promptIdentity = createAnalyticsConsentPromptIdentity({
    isAuthenticated,
    user,
  });
  const currentAccountUserId = user?.appUser._id ?? null;
  const shouldRevokeAccountGrant = shouldRevokeAccountAnalyticsGrant({
    accountConsent,
    browserConsent,
    isAccountConsentResolved: accountConsentQuery.isSuccess,
    isAuthenticated,
  });

  useEffect(() => {
    if (
      !(
        shouldRevokeAccountGrant &&
        isOnline &&
        promptIdentity &&
        currentAccountUserId
      )
    ) {
      return;
    }

    const recordRevocationFailure = Effect.sync(() =>
      setSessionOverrides((current) =>
        setAnalyticsConsentSessionOverride({
          override: { granted: false, persistence: "failed" },
          overrides: current,
          promptIdentity,
        })
      )
    );
    const clearRevocationOverride = Effect.sync(() =>
      setSessionOverrides((current) =>
        clearAnalyticsConsentSessionOverride({
          overrides: current,
          promptIdentity,
        })
      )
    );

    const revokeFiber = Effect.runFork(
      revokeAccountAnalyticsGrant(setAccountConsent, currentAccountUserId).pipe(
        Effect.matchEffect({
          onFailure: () => recordRevocationFailure,
          onSuccess: () => clearRevocationOverride,
        })
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(revokeFiber));
    };
  }, [
    currentAccountUserId,
    isOnline,
    promptIdentity,
    setAccountConsent,
    shouldRevokeAccountGrant,
  ]);

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
    hasLoadError,
    overrides: sessionOverrides,
    promptIdentity,
    status: state.status,
  });
  useEffect(() => {
    const analyticsIdentity = sessionPolicy.isRuntimeSuppressed
      ? null
      : createBrowserAnalyticsIdentity({
          accountConsent,
          anonymousConsent: browserConsent.anonymousConsent,
          isAuthenticated,
          status: state.status,
          user,
        });
    const alignRuntime = analyticsIdentity
      ? enableBrowserAnalytics().pipe(
          Effect.andThen(synchronizeBrowserAnalyticsIdentity(analyticsIdentity))
        )
      : disableBrowserAnalytics();
    const runtimeFiber = Effect.runFork(
      alignRuntime.pipe(
        Effect.andThen(Effect.sync(() => setRuntimeError(false))),
        Effect.catchTag("BrowserAnalyticsLoadFailed", () =>
          Effect.sync(() => setRuntimeError(true))
        )
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(runtimeFiber));
      Effect.runSync(disableBrowserAnalytics());
    };
  }, [
    accountConsent,
    browserConsent.anonymousConsent,
    isAuthenticated,
    sessionPolicy.isRuntimeSuppressed,
    state.status,
    user,
  ]);

  const accountConsentIsDecidable =
    accountConsentQuery.isSuccess || accountConsentQuery.isError;
  const canDecline =
    !(isPreviewChild || isAuthLoading || isUserPending) &&
    (isAuthenticated
      ? !!user && accountConsentIsDecidable
      : browserConsent.isResolved);
  const canGrant = canDecline && !browserConsent.hasBrowserPrivacySignal;
  let error: AnalyticsConsentError | null = null;
  if (hasLoadError) {
    error = "load";
  } else if (sessionPolicy.hasSaveError) {
    error = "save";
  } else if (hasRuntimeError) {
    error = "runtime";
  }

  function decide(granted: boolean) {
    const isAllowed = granted ? canGrant : canDecline;
    if (!(isAllowed && !sessionPolicy.isSaving && promptIdentity)) {
      return;
    }
    const expectedUserId = isAuthenticated ? (user?.appUser._id ?? null) : null;
    if (isAuthenticated && !expectedUserId) {
      return;
    }

    setSessionOverrides((current) =>
      setAnalyticsConsentSessionOverride({
        override: { granted, persistence: "pending" },
        overrides: current,
        promptIdentity,
      })
    );
    setPreferencesOpen(false);
    const recordPersistenceFailure = Effect.sync(() =>
      setSessionOverrides((current) =>
        setAnalyticsConsentSessionOverride({
          override: { granted, persistence: "failed" },
          overrides: current,
          promptIdentity,
        })
      )
    );
    const clearPersistenceOverride = Effect.sync(() =>
      setSessionOverrides((current) =>
        clearAnalyticsConsentSessionOverride({
          overrides: current,
          promptIdentity,
        })
      )
    );

    if (expectedUserId) {
      const accountSave = Effect.tryPromise(() =>
        setAccountConsent({
          decision: {
            category: ANALYTICS_CONSENT_CATEGORY,
            granted,
            mechanism: ANALYTICS_CONSENT_MECHANISM,
            noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
          },
          expectedUserId,
        })
      ).pipe(
        Effect.matchEffect({
          onFailure: () => recordPersistenceFailure,
          onSuccess: () => clearPersistenceOverride,
        })
      );
      startSaving(() => Effect.runPromise(accountSave));
      return;
    }

    const anonymousSave = saveDecision(granted).pipe(
      Effect.matchEffect({
        onFailure: () => recordPersistenceFailure,
        onSuccess: () => clearPersistenceOverride,
      })
    );

    startSaving(() => Effect.runPromise(anonymousSave));
  }

  const contextValue = {
    canDecline,
    canGrant,
    decide,
    error,
    isAvailable: !isPreviewChild,
    isPreferencesOpen,
    isPromptOpen: sessionPolicy.isPromptOpen,
    isSaving: sessionPolicy.isSaving,
    setPreferencesOpen,
    state,
  };

  return (
    <AnalyticsConsentContext.Provider value={contextValue}>
      {children}
    </AnalyticsConsentContext.Provider>
  );
}
