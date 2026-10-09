import type { InvokeReturn } from "@confect/react";
import { describe, expect, it } from "@effect/vitest";
import {
  ANALYTICS_CONSENT_NOTICE_VERSION,
  createAnonymousAnalyticsConsent,
} from "@repo/analytics/consent";
import {
  type AnalyticsConsentPromptIdentity,
  emptyAnalyticsConsentSessionOverrides,
} from "@repo/analytics/consent/session";
import { Id } from "@repo/backend/confect/_generated/id";
import type consents from "@repo/backend/confect/_generated/refs/consents";
import {
  Array as Arr,
  Duration,
  Effect,
  Exit,
  Fiber,
  HashMap,
  MutableList,
  Option,
  Result,
  Schema,
} from "effect";
import { TestClock } from "effect/testing";
import {
  type ConsentSaveAction,
  createConsentSaveAction,
} from "@/lib/analytics/consent/decision";
import { AnalyticsConsentStorageFailed } from "@/lib/analytics/consent/storage";
import type { AnalyticsConsentStoreState } from "@/lib/analytics/consent/store";

const promptIdentity = `anonymous:${ANALYTICS_CONSENT_NOTICE_VERSION}` as const;
const expectedUserId = Schema.decodeUnknownSync(Id("users"))("user-1");

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

describe("explicit consent save actions", () => {
  function createOptions(
    overrides: MutableList.MutableList<OverridesUpdate>,
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
        MutableList.append(overrides, update);
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
    const overrides = MutableList.make<OverridesUpdate>();
    const action = createConsentSaveAction({
      ...createOptions(overrides, {}),
      canGrant: false,
      granted: true,
      previousSave: null,
    });

    expect(action).toEqual({ kind: "ignore" });
    expect(MutableList.toArray(overrides)).toEqual([]);
  });

  it("ignores decisions that resolve no account user", () => {
    const overrides = MutableList.make<OverridesUpdate>();
    const action = createConsentSaveAction({
      ...createOptions(overrides, {}),
      granted: true,
      isAuthenticated: true,
      previousSave: null,
      promptIdentity: `account:user-1:${ANALYTICS_CONSENT_NOTICE_VERSION}`,
    });

    expect(action).toEqual({ kind: "ignore" });
    expect(MutableList.toArray(overrides)).toEqual([]);
  });

  it.effect("persists an anonymous grant through the save lifecycle", () =>
    Effect.gen(function* () {
      const overrides = MutableList.make<OverridesUpdate>();
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

      expect(
        readOverride(MutableList.toArray(overrides), promptIdentity)
      ).toMatchObject({
        persistence: "saved",
      });
    })
  );

  it.effect("records a save failure when anonymous persistence rejects", () =>
    Effect.gen(function* () {
      const overrides = MutableList.make<OverridesUpdate>();
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

      expect(
        readOverride(MutableList.toArray(overrides), promptIdentity)
      ).toMatchObject({
        persistence: "failed",
      });
    })
  );

  it.effect("interrupts a superseded save before persisting", () =>
    Effect.gen(function* () {
      const overrides = MutableList.make<OverridesUpdate>();
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
      expect(
        readOverride(
          Arr.take(MutableList.toArray(overrides), 2),
          promptIdentity
        )
      ).toMatchObject({ owner: second.owner });
    })
  );

  it.effect("records a save failure when account persistence rejects", () =>
    Effect.gen(function* () {
      const overrides = MutableList.make<OverridesUpdate>();
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
          MutableList.toArray(overrides),
          `account:user-1:${ANALYTICS_CONSENT_NOTICE_VERSION}`
        )
      ).toMatchObject({ persistence: "failed" });
    })
  );

  it.effect("persists an account grant for the active user", () =>
    Effect.gen(function* () {
      let seenArgs: unknown[] = [];
      const setAccountConsent = vi.fn(
        (...args: unknown[]): InvokeReturn<typeof consents.current.set> => {
          seenArgs = Arr.append(seenArgs, args[0]);
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
      const overrides = MutableList.make<OverridesUpdate>();
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
