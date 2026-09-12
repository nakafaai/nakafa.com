"use client";

import { Effect, Fiber } from "effect";
import { useEffect, useRef } from "react";
import {
  type AnalyticsConsentSave,
  createConsentSaveAction,
} from "@/lib/analytics/consent/decision";
import {
  type AnalyticsConsentPromptIdentity,
  cancelAnalyticsConsentSessionSave,
} from "@/lib/analytics/consent/session";

type DecisionHookOptions = Omit<
  Parameters<typeof createConsentSaveAction>[0],
  "granted" | "previousSave"
>;

/**
 * Owns the in-flight explicit-save fiber lifecycle for one consent controller.
 *
 * Callbacks close over stable refs only, so their identity survives renders
 * and consumer effects rerun solely on prompt changes. Options mirror
 * post-commit because render-time ref writes are banned.
 */
export function useAnalyticsConsentDecision(options: DecisionHookOptions) {
  const latestSaveRef = useRef<AnalyticsConsentSave | null>(null);
  const optionsRef = useRef(options);
  // Post-commit mirror: handlers and later cleanups read fresh options.
  useEffect(() => {
    optionsRef.current = options;
  });

  function decide(granted: boolean) {
    const action = createConsentSaveAction({
      ...optionsRef.current,
      granted,
      previousSave: latestSaveRef.current,
    });
    if (action.kind === "ignore") {
      return;
    }
    latestSaveRef.current = {
      fiber: Effect.runFork(action.program),
      owner: action.owner,
      promptIdentity: action.promptIdentity,
    };
  }

  function interruptDepartedSave(
    departedIdentity: AnalyticsConsentPromptIdentity
  ) {
    const activeSave = latestSaveRef.current;
    if (activeSave?.promptIdentity !== departedIdentity) {
      return;
    }
    latestSaveRef.current = null;
    Effect.runFork(
      Fiber.interrupt(activeSave.fiber).pipe(
        Effect.andThen(
          Effect.sync(() =>
            optionsRef.current.setSessionOverrides((current) =>
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
  }

  function readLatestSave() {
    return latestSaveRef.current;
  }

  return { decide, interruptDepartedSave, readLatestSave };
}
