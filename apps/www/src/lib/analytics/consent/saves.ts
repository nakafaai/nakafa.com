"use client";

import {
  type AnalyticsConsentPromptIdentity,
  cancelAnalyticsConsentSessionSave,
} from "@repo/analytics/consent/session";
import { Effect, Fiber, Option } from "effect";
import { useEffect, useRef } from "react";
import { createConsentSaveAction } from "@/lib/analytics/consent/decision";
import type { AnalyticsConsentStore } from "@/lib/analytics/consent/store";

type DecisionHookOptions = Omit<
  Parameters<typeof createConsentSaveAction>[0],
  "granted" | "previousSave"
>;

/**
 * Starts explicit consent saves and interrupts the one a departed visitor
 * scope still owns.
 *
 * The in-flight save lives in the consent store, so every reader's decision
 * and the controller's cleanups see the same save. Callbacks close over the
 * store and an options ref only, so their identity survives renders and
 * consumer effects rerun solely on prompt changes. Options mirror post-commit
 * because render-time ref writes are banned.
 */
export function useAnalyticsConsentDecision(
  store: AnalyticsConsentStore,
  options: DecisionHookOptions
) {
  const optionsRef = useRef(options);
  // Post-commit mirror: handlers and later cleanups read fresh options.
  useEffect(() => {
    optionsRef.current = options;
  });

  function decide(granted: boolean) {
    const { latestSave, setLatestSave } = store.getState();
    const action = createConsentSaveAction({
      ...optionsRef.current,
      granted,
      previousSave: Option.getOrNull(latestSave),
    });
    if (action.kind === "ignore") {
      return;
    }
    setLatestSave(
      Option.some({
        fiber: Effect.runFork(action.program),
        owner: action.owner,
        promptIdentity: action.promptIdentity,
      })
    );
  }

  function interruptDepartedSave(
    departedIdentity: AnalyticsConsentPromptIdentity
  ) {
    const { latestSave, setLatestSave } = store.getState();
    const activeSave = Option.getOrNull(latestSave);
    if (activeSave?.promptIdentity !== departedIdentity) {
      return;
    }
    setLatestSave(Option.none());
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
    return Option.getOrNull(store.getState().latestSave);
  }

  return { decide, interruptDepartedSave, readLatestSave };
}
