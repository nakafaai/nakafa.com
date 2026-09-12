"use client";

import { Effect, Fiber } from "effect";
import { useCallback, useRef } from "react";
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
 * The latest-save ref never crosses render: it is read and written only from
 * event handlers and effects owned by this hook. Returned callbacks keep a
 * stable identity across renders (options are read through a mirror ref) so
 * consumer effects only re-run when the prompt identity actually departs,
 * never because a parent re-rendered after recording pending state.
 */
export function useAnalyticsConsentDecision(options: DecisionHookOptions) {
  const latestSaveRef = useRef<AnalyticsConsentSave | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const decide = useCallback((granted: boolean) => {
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
  }, []);

  const interruptDepartedSave = useCallback(
    (departedIdentity: AnalyticsConsentPromptIdentity) => {
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
    },
    []
  );

  const readLatestSave = useCallback(() => latestSaveRef.current, []);

  return { decide, interruptDepartedSave, readLatestSave };
}
