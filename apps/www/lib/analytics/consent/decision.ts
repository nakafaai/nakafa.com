"use client";

import { Effect, Fiber } from "effect";
import type { Dispatch, SetStateAction } from "react";
import type { useAnonymousAnalyticsConsent } from "@/lib/analytics/consent/browser";
import type { AnalyticsConsentError } from "@/lib/analytics/consent/context";
import {
  type AnalyticsConsentPromptIdentity,
  type AnalyticsConsentSessionOperation,
  type AnalyticsConsentSessionOverrides,
  cancelAnalyticsConsentSessionSave,
  completeAnalyticsConsentSessionSave,
  setAnalyticsConsentSessionOverride,
} from "@/lib/analytics/consent/session";
import { saveAccountAnalyticsChoice } from "@/lib/analytics/consent/signal";

export interface AnalyticsConsentSave extends AnalyticsConsentSessionOperation {
  readonly fiber: Fiber.Fiber<void, never>;
}

/** Resolves the single surfaced error with load errors winning over retries. */
export function resolveConsentError({
  hasLoadError,
  hasRuntimeError,
  hasSaveError,
}: {
  readonly hasLoadError: boolean;
  readonly hasRuntimeError: boolean;
  readonly hasSaveError: boolean;
}): AnalyticsConsentError | null {
  if (hasLoadError) {
    return "load";
  }
  if (hasSaveError) {
    return "save";
  }
  if (hasRuntimeError) {
    return "runtime";
  }
  return null;
}

/** Resolves whether the current visitor may decline or grant analytics. */
export function resolveConsentAffordances({
  hasBrowserPrivacySignal,
  isAccountResolved,
  isAnonymousResolved,
  isAuthenticated,
  isBlocked,
}: {
  readonly hasBrowserPrivacySignal: boolean;
  readonly isAccountResolved: boolean;
  readonly isAnonymousResolved: boolean;
  readonly isAuthenticated: boolean;
  readonly isBlocked: boolean;
}): {
  readonly canDecline: boolean;
  readonly canGrant: boolean;
} {
  const canDecline =
    !isBlocked && (isAuthenticated ? isAccountResolved : isAnonymousResolved);
  return {
    canDecline,
    canGrant: canDecline && !hasBrowserPrivacySignal,
  };
}

interface ConsentSaveActionOptions {
  readonly canDecline: boolean;
  readonly canGrant: boolean;
  readonly currentBrowserPrivacySignal: Parameters<
    typeof saveAccountAnalyticsChoice
  >[3];
  readonly granted: boolean;
  readonly isAuthenticated: boolean;
  readonly isSaving: boolean;
  readonly previousSave: AnalyticsConsentSave | null;
  readonly promptIdentity: AnalyticsConsentPromptIdentity | null;
  readonly saveDecision: ReturnType<
    typeof useAnonymousAnalyticsConsent
  >["saveDecision"];
  readonly setAccountConsent: Parameters<typeof saveAccountAnalyticsChoice>[0];
  readonly setPreferencesOpen: (isOpen: boolean) => void;
  readonly setSessionOverrides: Dispatch<
    SetStateAction<AnalyticsConsentSessionOverrides>
  >;
  readonly user: {
    readonly appUser: {
      readonly _id: Parameters<typeof saveAccountAnalyticsChoice>[1];
    };
  } | null;
}

export type ConsentSaveAction =
  | { readonly kind: "ignore" }
  | {
      readonly kind: "save";
      readonly owner: symbol;
      readonly program: Effect.Effect<void, never>;
      readonly promptIdentity: AnalyticsConsentPromptIdentity;
    };

/**
 * Builds the explicit save program for one grant or deny decision.
 *
 * Pure construction over explicit inputs: guards become `ignore`, otherwise
 * the program records pending state, interrupts a superseded save, persists
 * the decision, and records its outcome. Forking stays with the caller.
 */
export function createConsentSaveAction({
  canDecline,
  canGrant,
  currentBrowserPrivacySignal,
  granted,
  isAuthenticated,
  isSaving,
  previousSave,
  promptIdentity,
  saveDecision,
  setAccountConsent,
  setPreferencesOpen,
  setSessionOverrides,
  user,
}: ConsentSaveActionOptions): ConsentSaveAction {
  const isAllowed = granted ? canGrant : canDecline;
  if (!(isAllowed && !isSaving && promptIdentity)) {
    return { kind: "ignore" };
  }
  const expectedUserId = isAuthenticated ? (user?.appUser._id ?? null) : null;
  if (isAuthenticated && !expectedUserId) {
    return { kind: "ignore" };
  }

  const saveOwner = Symbol("analytics consent save");
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
  const persistDecision = expectedUserId
    ? saveAccountAnalyticsChoice(
        setAccountConsent,
        expectedUserId,
        granted,
        currentBrowserPrivacySignal
      ).pipe(
        Effect.matchEffect({
          onFailure: () => recordPersistenceFailure,
          onSuccess: (decision) => recordPersistenceSuccess(decision.decidedAt),
        })
      )
    : saveDecision(granted).pipe(
        Effect.matchEffect({
          onFailure: () => recordPersistenceFailure,
          onSuccess: (consent) => recordPersistenceSuccess(consent.decidedAt),
        })
      );
  const interruptPrevious = previousSave
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
        )
      )
    : Effect.void;
  const program = Effect.sync(() => {
    setSessionOverrides((current) =>
      setAnalyticsConsentSessionOverride({
        override: { owner: saveOwner, persistence: "pending" },
        overrides: current,
        promptIdentity,
      })
    );
    setPreferencesOpen(false);
  }).pipe(Effect.andThen(interruptPrevious), Effect.andThen(persistDecision));

  return { kind: "save", owner: saveOwner, program, promptIdentity };
}
