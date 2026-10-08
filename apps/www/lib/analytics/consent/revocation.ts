"use client";

import { Effect, Fiber, Option } from "effect";
import { useEffect, useRef } from "react";
import type { useAnalyticsConsentModel } from "@/lib/analytics/consent/model";
import {
  type AnalyticsConsentSessionOperation,
  canCommitAnalyticsConsentRevocation,
  setAnalyticsConsentSessionOverride,
} from "@/lib/analytics/consent/session";
import { revokeAccountAnalyticsGrant } from "@/lib/analytics/consent/signal";

type AnalyticsConsentModel = ReturnType<typeof useAnalyticsConsentModel>;

/** The consent model fields that decide and perform one account revocation. */
type AccountAnalyticsConsentRevocationSource = Pick<
  AnalyticsConsentModel,
  | "currentAccountUserId"
  | "currentBrowserPrivacySignal"
  | "promptIdentity"
  | "readLatestSave"
  | "setAccountConsent"
  | "setSessionOverrides"
  | "shouldRevokeAccountGrant"
>;

/** Revokes an account grant when the browser begins enforcing DNT or GPC. */
export function useAccountAnalyticsConsentRevocation(
  {
    currentAccountUserId,
    currentBrowserPrivacySignal,
    promptIdentity,
    readLatestSave,
    setAccountConsent,
    setSessionOverrides,
    shouldRevokeAccountGrant,
  }: AccountAnalyticsConsentRevocationSource,
  isOnline: boolean
) {
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
    const latestSaveAtStart = readLatestSave();
    const explicitSaveOwnerAtStart =
      latestSaveAtStart?.promptIdentity === promptIdentity
        ? latestSaveAtStart.owner
        : null;
    revocationRef.current = { owner: revocationOwner, promptIdentity };

    const recordRevocation = (
      override:
        | { readonly persistence: "failed" }
        | { readonly decidedAt: number; readonly persistence: "saved" }
    ) =>
      Effect.sync(() =>
        setSessionOverrides((current) => {
          const latestExplicitSave = readLatestSave();
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
    isOnline,
    promptIdentity,
    readLatestSave,
    setAccountConsent,
    setSessionOverrides,
    shouldRevokeAccountGrant,
  ]);
}
