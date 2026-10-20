"use client";

import {
  type AnalyticsConsentPromptIdentity,
  type AnalyticsConsentSessionOperation,
  type AnalyticsConsentSessionOverride,
  canCommitAnalyticsConsentRevocation,
  setAnalyticsConsentSessionOverride,
} from "@repo/analytics/consent/session";
import { Effect, Fiber, Option } from "effect";
import { useEffect, useRef } from "react";
import { revokeAccountAnalyticsGrant } from "@/lib/analytics/consent/signal";
import type { AnalyticsConsentStoreState } from "@/lib/analytics/consent/store";

/** Revokes an account grant when the browser begins enforcing DNT or GPC. */
export function useAccountAnalyticsConsentRevocation({
  currentAccountUserId,
  currentBrowserPrivacySignal,
  isOnline,
  promptIdentity,
  readLatestSave,
  setAccountConsent,
  setSessionOverrides,
  shouldRevokeAccountGrant,
}: {
  readonly currentAccountUserId:
    | Parameters<typeof revokeAccountAnalyticsGrant>[1]
    | null;
  readonly currentBrowserPrivacySignal: Effect.Effect<boolean>;
  readonly isOnline: boolean;
  readonly promptIdentity: AnalyticsConsentPromptIdentity | null;
  readonly readLatestSave: () => AnalyticsConsentSessionOperation | null;
  readonly setAccountConsent: Parameters<typeof revokeAccountAnalyticsGrant>[0];
  readonly setSessionOverrides: AnalyticsConsentStoreState["setSessionOverrides"];
  readonly shouldRevokeAccountGrant: boolean;
}) {
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
      override: Exclude<
        AnalyticsConsentSessionOverride,
        { readonly persistence: "pending" }
      >
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
