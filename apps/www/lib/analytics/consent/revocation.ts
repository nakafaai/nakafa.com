"use client";

import { Effect, Fiber, Option } from "effect";
import { type Dispatch, type SetStateAction, useEffect, useRef } from "react";
import {
  type AnalyticsConsentPromptIdentity,
  type AnalyticsConsentSessionOperation,
  type AnalyticsConsentSessionOverrides,
  canCommitAnalyticsConsentRevocation,
  setAnalyticsConsentSessionOverride,
} from "@/lib/analytics/consent/session";
import { revokeAccountAnalyticsGrant } from "@/lib/analytics/consent/signal";

interface AccountAnalyticsConsentRevocationOptions {
  readonly currentAccountUserId:
    | Parameters<typeof revokeAccountAnalyticsGrant>[1]
    | null;
  readonly currentBrowserPrivacySignal: Effect.Effect<boolean>;
  readonly explicitSaveRef: {
    readonly current: AnalyticsConsentSessionOperation | null;
  };
  readonly isOnline: boolean;
  readonly promptIdentity: AnalyticsConsentPromptIdentity | null;
  readonly setAccountConsent: Parameters<typeof revokeAccountAnalyticsGrant>[0];
  readonly setSessionOverrides: Dispatch<
    SetStateAction<AnalyticsConsentSessionOverrides>
  >;
  readonly shouldRevokeAccountGrant: boolean;
}

/** Revokes an account grant when the browser begins enforcing DNT or GPC. */
export function useAccountAnalyticsConsentRevocation({
  currentAccountUserId,
  currentBrowserPrivacySignal,
  explicitSaveRef,
  isOnline,
  promptIdentity,
  setAccountConsent,
  setSessionOverrides,
  shouldRevokeAccountGrant,
}: AccountAnalyticsConsentRevocationOptions) {
  const revocationRef = useRef<AnalyticsConsentSessionOperation | null>(null);

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

    const revocationOwner = Symbol("analytics consent revocation");
    const explicitSaveOwnerAtStart =
      explicitSaveRef.current?.promptIdentity === promptIdentity
        ? explicitSaveRef.current.owner
        : null;
    revocationRef.current = { owner: revocationOwner, promptIdentity };

    const recordRevocation = (
      override:
        | { readonly persistence: "failed" }
        | { readonly decidedAt: number; readonly persistence: "saved" }
    ) =>
      Effect.sync(() =>
        setSessionOverrides((current) => {
          const latestExplicitSave = explicitSaveRef.current;
          if (
            !canCommitAnalyticsConsentRevocation({
              explicitSaveOwnerAtStart,
              latestExplicitSave,
              latestRevocation: revocationRef.current,
              promptIdentity,
              revocationOwner,
            })
          ) {
            return current;
          }

          return setAnalyticsConsentSessionOverride({
            override,
            overrides: current,
            promptIdentity,
          });
        })
      );
    const revokeFiber = Effect.runFork(
      revokeAccountAnalyticsGrant(
        setAccountConsent,
        currentAccountUserId,
        currentBrowserPrivacySignal
      ).pipe(
        Effect.matchEffect({
          onFailure: () => recordRevocation({ persistence: "failed" }),
          onSuccess: Option.match({
            onNone: () => Effect.void,
            onSome: (decision) =>
              recordRevocation({
                decidedAt: decision.decidedAt,
                persistence: "saved",
              }),
          }),
        })
      )
    );

    return () => {
      if (revocationRef.current?.owner === revocationOwner) {
        revocationRef.current = null;
      }
      Effect.runFork(Fiber.interrupt(revokeFiber));
    };
  }, [
    currentAccountUserId,
    currentBrowserPrivacySignal,
    explicitSaveRef,
    isOnline,
    promptIdentity,
    setAccountConsent,
    setSessionOverrides,
    shouldRevokeAccountGrant,
  ]);
}
