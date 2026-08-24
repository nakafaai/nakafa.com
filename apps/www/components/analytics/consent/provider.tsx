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
  createAnalyticsConsentPromptIdentity,
  createBrowserAnalyticsIdentity,
  resolveBrowserAnalyticsConsentState,
  shouldRevokeAccountAnalyticsGrant,
  shouldShowAnalyticsConsentPrompt,
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
  const [operationError, setOperationError] =
    useState<AnalyticsConsentError | null>(null);
  const [dismissedPromptIdentity, setDismissedPromptIdentity] = useState<
    string | null
  >(null);
  const [isPreferencesOpen, setPreferencesOpen] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const { online: isOnline } = useNetwork();
  const setAccountConsent = useMutation(api.consents.mutations.setCurrent);
  const shouldLoadAccountConsent =
    !isPreviewChild && isAuthenticated && !isAuthLoading && !!user;
  const accountConsentQuery = useQueryWithStatus(
    api.consents.queries.getCurrent,
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
  const shouldRevokeAccountGrant = shouldRevokeAccountAnalyticsGrant({
    accountConsent,
    browserConsent,
    isAccountConsentResolved: accountConsentQuery.isSuccess,
    isAuthenticated,
  });

  useEffect(() => {
    if (!(shouldRevokeAccountGrant && isOnline)) {
      return;
    }

    const revokeFiber = Effect.runFork(
      revokeAccountAnalyticsGrant(setAccountConsent).pipe(
        Effect.matchEffect({
          onFailure: () => Effect.sync(() => setOperationError("save")),
          onSuccess: () => Effect.sync(() => setOperationError(null)),
        })
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(revokeFiber));
    };
  }, [isOnline, setAccountConsent, shouldRevokeAccountGrant]);

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
  useEffect(() => {
    const analyticsIdentity = createBrowserAnalyticsIdentity({
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
        Effect.andThen(
          Effect.sync(() =>
            setOperationError((current) =>
              current === "runtime" ? null : current
            )
          )
        ),
        Effect.catchTag("BrowserAnalyticsLoadFailed", () =>
          Effect.sync(() => setOperationError("runtime"))
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
  const error =
    accountConsentQuery.isError || (!isAuthenticated && hasStorageError)
      ? "load"
      : operationError;
  const promptIdentity = createAnalyticsConsentPromptIdentity({
    isAuthenticated,
    user,
  });
  const isPromptOpen = shouldShowAnalyticsConsentPrompt({
    dismissedPromptIdentity,
    hasLoadError: error === "load",
    promptIdentity,
    status: state.status,
  });

  function decide(granted: boolean) {
    const isAllowed = granted ? canGrant : canDecline;
    if (!(isAllowed && !isSaving)) {
      return;
    }

    setOperationError(null);
    setDismissedPromptIdentity(promptIdentity);
    setPreferencesOpen(false);
    const onSaveFailure = () =>
      disableBrowserAnalytics().pipe(
        Effect.andThen(
          Effect.sync(() => {
            setOperationError("save");
          })
        )
      );
    const onSaveSuccess = () =>
      granted ? Effect.void : disableBrowserAnalytics();

    if (isAuthenticated) {
      const accountSave = Effect.tryPromise(() =>
        setAccountConsent({
          decision: {
            category: ANALYTICS_CONSENT_CATEGORY,
            granted,
            mechanism: ANALYTICS_CONSENT_MECHANISM,
            noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
          },
        })
      ).pipe(
        Effect.matchEffect({
          onFailure: onSaveFailure,
          onSuccess: onSaveSuccess,
        })
      );
      startSaving(() => Effect.runPromise(accountSave));
      return;
    }

    const anonymousSave = saveDecision(granted).pipe(
      Effect.matchEffect({
        onFailure: onSaveFailure,
        onSuccess: onSaveSuccess,
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
    isPromptOpen,
    isSaving,
    setPreferencesOpen,
    state,
  };

  return (
    <AnalyticsConsentContext.Provider value={contextValue}>
      {children}
    </AnalyticsConsentContext.Provider>
  );
}
