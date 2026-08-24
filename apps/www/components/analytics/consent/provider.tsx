"use client";

import { useNetwork } from "@mantine/hooks";
import { ANALYTICS_CONSENT_CATEGORY } from "@repo/analytics/consent";
import {
  disableBrowserAnalytics,
  enableBrowserAnalytics,
  synchronizeBrowserAnalyticsIdentity,
} from "@repo/analytics/posthog/browser";
import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { useConvexAuth, useMutation } from "convex/react";
import { Effect, Fiber, Option } from "effect";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { env } from "@/env";
import { useAnonymousAnalyticsConsent } from "@/lib/analytics/consent/browser";
import {
  AnalyticsConsentContext,
  type AnalyticsConsentError,
} from "@/lib/analytics/consent/context";
import {
  initialConsentPreferences,
  updateConsentPreferences,
} from "@/lib/analytics/consent/preferences";
import {
  type AnalyticsConsentPromptIdentity,
  type AnalyticsConsentSessionOverrides,
  cancelAnalyticsConsentSessionSave,
  completeAnalyticsConsentSessionSave,
  createAnalyticsConsentPromptIdentity,
  resolveAnalyticsConsentSessionPolicy,
  setAnalyticsConsentSessionOverride,
} from "@/lib/analytics/consent/session";
import {
  revokeAccountAnalyticsGrant,
  saveAccountAnalyticsChoice,
} from "@/lib/analytics/consent/signal";
import {
  createBrowserAnalyticsIdentity,
  resolveBrowserAnalyticsConsentState,
  shouldRevokeAccountAnalyticsGrant,
} from "@/lib/analytics/consent/state";
import { useUser } from "@/lib/context/use-user";

const isPreviewChild = env.NEXT_PUBLIC_AKSARA_PREVIEW_CHILD === "true";

interface ActiveAnalyticsConsentSave {
  readonly fiber: Fiber.Fiber<void, never>;
  readonly owner: symbol;
  readonly promptIdentity: AnalyticsConsentPromptIdentity;
}

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
  const [preferences, setPreferences] = useState(initialConsentPreferences);
  const explicitSaveRef = useRef<ActiveAnalyticsConsentSave | null>(null);
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

  useEffect(() => {
    const interruptExplicitSave = () => {
      const activeSave = explicitSaveRef.current;
      if (!activeSave) {
        return;
      }

      explicitSaveRef.current = null;
      Effect.runFork(
        Fiber.interrupt(activeSave.fiber).pipe(
          Effect.andThen(
            Effect.sync(() =>
              setSessionOverrides((current) =>
                cancelAnalyticsConsentSessionSave({
                  overrides: current,
                  owner: activeSave.owner,
                  promptIdentity: activeSave.promptIdentity,
                })
              )
            )
          )
        )
      );
    };

    if (!promptIdentity) {
      interruptExplicitSave();
      return;
    }

    return interruptExplicitSave;
  }, [promptIdentity]);

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
          override: { persistence: "failed" },
          overrides: current,
          promptIdentity,
        })
      )
    );
    const recordRevocationSuccess = (decidedAt: number) =>
      Effect.sync(() =>
        setSessionOverrides((current) =>
          setAnalyticsConsentSessionOverride({
            override: { decidedAt, persistence: "saved" },
            overrides: current,
            promptIdentity,
          })
        )
      );
    const revokeFiber = Effect.runFork(
      revokeAccountAnalyticsGrant(
        setAccountConsent,
        currentAccountUserId,
        currentBrowserPrivacySignal
      ).pipe(
        Effect.matchEffect({
          onFailure: () => recordRevocationFailure,
          onSuccess: Option.match({
            onNone: () => Effect.void,
            onSome: (decision) => recordRevocationSuccess(decision.decidedAt),
          }),
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
    currentBrowserPrivacySignal,
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
    durableConsent,
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

  function setPreferencesOpen(isOpen: boolean) {
    setPreferences((current) =>
      updateConsentPreferences({
        current,
        isOpen,
        status: sessionPolicy.status,
      })
    );
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

    const saveOwner = Symbol("analytics consent save");
    setSessionOverrides((current) =>
      setAnalyticsConsentSessionOverride({
        override: { owner: saveOwner, persistence: "pending" },
        overrides: current,
        promptIdentity,
      })
    );
    setPreferencesOpen(false);
    const recordPersistenceFailure = Effect.sync(() =>
      setSessionOverrides((current) =>
        completeAnalyticsConsentSessionSave({
          nextOverride: { persistence: "failed" },
          overrides: current,
          owner: saveOwner,
          promptIdentity,
        })
      )
    );
    const recordPersistenceSuccess = (decidedAt: number) =>
      Effect.sync(() =>
        setSessionOverrides((current) =>
          completeAnalyticsConsentSessionSave({
            nextOverride: { decidedAt, persistence: "saved" },
            overrides: current,
            owner: saveOwner,
            promptIdentity,
          })
        )
      );

    const runExplicitSave = (program: Effect.Effect<void, never>) => {
      const previousSave = explicitSaveRef.current;
      const nextProgram = previousSave
        ? Fiber.interrupt(previousSave.fiber).pipe(
            Effect.andThen(
              Effect.sync(() =>
                setSessionOverrides((current) =>
                  cancelAnalyticsConsentSessionSave({
                    overrides: current,
                    owner: previousSave.owner,
                    promptIdentity: previousSave.promptIdentity,
                  })
                )
              )
            ),
            Effect.andThen(program)
          )
        : program;

      explicitSaveRef.current = {
        fiber: Effect.runFork(nextProgram),
        owner: saveOwner,
        promptIdentity,
      };
    };

    if (expectedUserId) {
      const accountSave = saveAccountAnalyticsChoice(
        setAccountConsent,
        expectedUserId,
        granted,
        currentBrowserPrivacySignal
      ).pipe(
        Effect.matchEffect({
          onFailure: () => recordPersistenceFailure,
          onSuccess: (decision) => recordPersistenceSuccess(decision.decidedAt),
        })
      );
      runExplicitSave(accountSave);
      return;
    }

    const anonymousSave = saveDecision(granted).pipe(
      Effect.matchEffect({
        onFailure: () => recordPersistenceFailure,
        onSuccess: (consent) => recordPersistenceSuccess(consent.decidedAt),
      })
    );

    runExplicitSave(anonymousSave);
  }

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
