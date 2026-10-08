import type { InvokeReturn } from "@confect/react";
import { describe, expect, it } from "@effect/vitest";
import {
  ANALYTICS_CONSENT_NOTICE_VERSION,
  createAnonymousAnalyticsConsent,
} from "@repo/analytics/consent";
import type refs from "@repo/backend/confect/_generated/refs";
import type { Id } from "@repo/backend/convex/_generated/dataModel";

import {
  Array as Arr,
  Duration,
  Effect,
  Exit,
  Fiber,
  HashMap,
  Option,
  Result,
} from "effect";
import { TestClock } from "effect/testing";
import {
  type ConsentSaveAction,
  createConsentSaveAction,
  resolveConsentAffordances,
  resolveConsentError,
} from "@/lib/analytics/consent/decision";
import {
  type AnalyticsConsentPromptIdentity,
  emptyAnalyticsConsentSessionOverrides,
} from "@/lib/analytics/consent/session";
import { AnalyticsConsentStorageFailed } from "@/lib/analytics/consent/storage";
import type { AnalyticsConsentStoreState } from "@/lib/analytics/consent/store";

const promptIdentity = `anonymous:${ANALYTICS_CONSENT_NOTICE_VERSION}` as const;

type OverridesUpdate = Parameters<
  AnalyticsConsentStoreState["setSessionOverrides"]
>[0];

/** Applies recorded override updates in order and reads one visitor's choice. */
function readOverride(
  updates: readonly OverridesUpdate[],
  identity: AnalyticsConsentPromptIdentity
) {
  return Arr.reduce(
    updates,
    emptyAnalyticsConsentSessionOverrides,
    (current, update) => update(current)
  ).pipe(HashMap.get(identity), Option.getOrUndefined);
}

describe("consent affordance resolution", () => {
  const healthyAnonymous = {
    hasBrowserPrivacySignal: false,
    isAccountResolved: false,
    isAnonymousResolved: true,
    isAuthenticated: false,
    isBlocked: false,
  };

  it("lets an anonymous visitor decide until a privacy signal blocks grants", () => {
    expect(resolveConsentAffordances(healthyAnonymous)).toEqual({
      canDecline: true,
      canGrant: true,
    });
    expect(
      resolveConsentAffordances({
        ...healthyAnonymous,
        hasBrowserPrivacySignal: true,
      })
    ).toEqual({ canDecline: true, canGrant: false });
  });

  it("requires a resolved account before an authenticated visitor decides", () => {
    const authenticated = {
      ...healthyAnonymous,
      isAccountResolved: false,
      isAuthenticated: true,
    };

    expect(resolveConsentAffordances(authenticated)).toEqual({
      canDecline: false,
      canGrant: false,
    });
    expect(
      resolveConsentAffordances({ ...authenticated, isAccountResolved: true })
    ).toEqual({ canDecline: true, canGrant: true });
  });

  it("blocks every decision while loading, pending, or previewing", () => {
    expect(
      resolveConsentAffordances({ ...healthyAnonymous, isBlocked: true })
    ).toEqual({ canDecline: false, canGrant: false });
    expect(
      resolveConsentAffordances({
        ...healthyAnonymous,
        isAnonymousResolved: false,
      })
    ).toEqual({ canDecline: false, canGrant: false });
  });
});

describe("consent error resolution", () => {
  it("stays clear when every source is healthy", () => {
    expect(
      resolveConsentError({
        hasLoadError: false,
        hasRuntimeError: false,
        hasSaveError: false,
      })
    ).toBeNull();
  });

  it("prefers load errors over save and runtime errors", () => {
    expect(
      resolveConsentError({
        hasLoadError: true,
        hasRuntimeError: true,
        hasSaveError: true,
      })
    ).toBe("load");
  });

  it("prefers save errors over runtime errors", () => {
    expect(
      resolveConsentError({
        hasLoadError: false,
        hasRuntimeError: true,
        hasSaveError: true,
      })
    ).toBe("save");
  });

  it("surfaces runtime errors last", () => {
    expect(
      resolveConsentError({
        hasLoadError: false,
        hasRuntimeError: true,
        hasSaveError: false,
      })
    ).toBe("runtime");
  });
});

describe("explicit consent save actions", () => {
  function createOptions(
    overrides: OverridesUpdate[],
    options?: {
      readonly saveDecision?: (
        granted: boolean
      ) => Effect.Effect<
        ReturnType<typeof createAnonymousAnalyticsConsent>,
        AnalyticsConsentStorageFailed
      >;
    }
  ) {
    return {
      canDecline: true,
      canGrant: true,
      currentBrowserPrivacySignal: Effect.succeed(false),
      isAuthenticated: false,
      isSaving: false,
      promptIdentity,
      saveDecision:
        options?.saveDecision ??
        ((granted: boolean) =>
          Effect.succeed(
            createAnonymousAnalyticsConsent(granted ? "granted" : "denied", 100)
          )),
      setAccountConsent: () => Promise.reject(new Error("account path unused")),
      setPreferencesOpen: vi.fn(),
      setSessionOverrides: (update: OverridesUpdate) => {
        overrides.push(update);
      },
      user: null,
    };
  }

  function runProgram(action: ConsentSaveAction) {
    if (action.kind === "ignore") {
      return Effect.succeed(false);
    }
    return Effect.as(action.program, true);
  }

  it("ignores disallowed decisions without touching persistence", () => {
    const overrides: OverridesUpdate[] = [];
    const action = createConsentSaveAction({
      ...createOptions(overrides, {}),
      canGrant: false,
      granted: true,
      previousSave: null,
    });

    expect(action).toEqual({ kind: "ignore" });
    expect(overrides).toEqual([]);
  });

  it("ignores decisions that resolve no account user", () => {
    const overrides: OverridesUpdate[] = [];
    const action = createConsentSaveAction({
      ...createOptions(overrides, {}),
      granted: true,
      isAuthenticated: true,
      previousSave: null,
      promptIdentity: `account:user-1:${ANALYTICS_CONSENT_NOTICE_VERSION}`,
    });

    expect(action).toEqual({ kind: "ignore" });
    expect(overrides).toEqual([]);
  });

  it.effect("persists an anonymous grant through the save lifecycle", () =>
    Effect.gen(function* () {
      const overrides: OverridesUpdate[] = [];
      const action = createConsentSaveAction({
        ...createOptions(overrides, {}),
        granted: true,
        previousSave: null,
      });

      if (action.kind !== "save") {
        return yield* Effect.fail("expected a save action");
      }
      expect(action.promptIdentity).toBe(promptIdentity);
      yield* action.program;

      expect(readOverride(overrides, promptIdentity)).toMatchObject({
        persistence: "saved",
      });
    })
  );

  it.effect("records a save failure when anonymous persistence rejects", () =>
    Effect.gen(function* () {
      const overrides: OverridesUpdate[] = [];
      const action = createConsentSaveAction({
        ...createOptions(overrides, {
          saveDecision: () =>
            Effect.fail(
              new AnalyticsConsentStorageFailed({
                code: "ANALYTICS_CONSENT_STORAGE_FAILED",
              })
            ),
        }),
        granted: false,
        previousSave: null,
      });

      yield* runProgram(action);

      expect(readOverride(overrides, promptIdentity)).toMatchObject({
        persistence: "failed",
      });
    })
  );

  it.effect("interrupts a superseded save before persisting", () =>
    Effect.gen(function* () {
      const overrides: OverridesUpdate[] = [];
      const first = createConsentSaveAction({
        ...createOptions(overrides, {}),
        granted: true,
        previousSave: null,
      });
      if (first.kind !== "save") {
        return yield* Effect.fail("expected a first save action");
      }
      const firstFiber = yield* Effect.forkScoped(first.program);
      const second = createConsentSaveAction({
        ...createOptions(overrides, {}),
        granted: false,
        previousSave: {
          fiber: firstFiber,
          owner: first.owner,
          promptIdentity: first.promptIdentity,
        },
      });
      if (second.kind !== "save") {
        return yield* Effect.fail("expected a superseding save action");
      }

      yield* runProgram(second);
      const firstExit = yield* Fiber.await(firstFiber);
      expect(Exit.isFailure(firstExit)).toBe(true);
      expect(readOverride(overrides.slice(0, 2), promptIdentity)).toMatchObject(
        { owner: second.owner }
      );
    })
  );

  it.effect("records a save failure when account persistence rejects", () =>
    Effect.gen(function* () {
      const expectedUserId = "user-1" as Id<"users">;
      const overrides: OverridesUpdate[] = [];
      const action = createConsentSaveAction({
        ...createOptions(overrides, {}),
        granted: true,
        isAuthenticated: true,
        previousSave: null,
        promptIdentity: `account:user-1:${ANALYTICS_CONSENT_NOTICE_VERSION}`,
        setAccountConsent: () =>
          Promise.reject(new Error("convex unavailable")),
        user: { appUser: { _id: expectedUserId } },
      });

      if (action.kind !== "save") {
        return yield* Effect.fail("expected a save action");
      }
      const fiber = yield* Effect.forkChild(action.program);
      yield* TestClock.adjust(Duration.seconds(30));
      yield* Fiber.join(fiber);

      expect(
        readOverride(
          overrides,
          `account:user-1:${ANALYTICS_CONSENT_NOTICE_VERSION}`
        )
      ).toMatchObject({ persistence: "failed" });
    })
  );

  it.effect("persists an account grant for the active user", () =>
    Effect.gen(function* () {
      const expectedUserId = "user-1" as Id<"users">;
      const seenArgs: unknown[] = [];
      const setAccountConsent = vi.fn(
        (
          ...args: unknown[]
        ): InvokeReturn<typeof refs.public.consents.current.set> => {
          seenArgs.push(args[0]);
          return Promise.resolve(
            Result.succeed({
              category: "analytics",
              decidedAt: 200,
              granted: true,
              mechanism: "privacy-controls",
              noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
            })
          );
        }
      );
      const overrides: OverridesUpdate[] = [];
      const action = createConsentSaveAction({
        ...createOptions(overrides, {}),
        granted: true,
        isAuthenticated: true,
        previousSave: null,
        promptIdentity: `account:user-1:${ANALYTICS_CONSENT_NOTICE_VERSION}`,
        setAccountConsent,
        user: { appUser: { _id: expectedUserId } },
      });

      yield* runProgram(action);

      expect(setAccountConsent).toHaveBeenCalledOnce();
      expect(seenArgs[0]).toMatchObject({
        decision: expect.objectContaining({ granted: true }),
        expectedUserId,
      });
    })
  );
});
