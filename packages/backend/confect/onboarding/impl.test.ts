import { mutationLayer } from "@confect/server/RegisteredConvexFunction";
import { describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  admitOnboarding,
  finishOnboarding,
  saveOnboardingAnswer,
} from "@repo/backend/confect/onboarding/impl";
import {
  activateOnboardingPrograms,
  createOnboardingTest,
} from "@repo/backend/test/onboarding";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
  makeTechnicalProgram,
} from "@repo/backend/test/program/snapshot";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 7, 31, 12, 0, 0);
describe("onboarding/impl", () => {
  it.effect.each([
    {
      operation: "admit",
      existing: false,
      table: "onboardingProfiles",
    },
    {
      operation: "admit",
      existing: true,
      table: "onboardingProfiles",
    },
    {
      operation: "save",
      existing: false,
      table: "onboardingProfiles",
    },
    {
      operation: "save",
      existing: true,
      table: "onboardingProfiles",
    },
    {
      operation: "finish",
      existing: false,
      table: "users",
    },
    {
      operation: "finish",
      existing: false,
      table: "onboardingProfiles",
    },
    {
      operation: "finish",
      existing: true,
      table: "onboardingProfiles",
    },
  ] as const)(
    "rolls back $operation for a failed $table write with existing=$existing",
    ({ operation, existing, table }) =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const { identity, test } = yield* createOnboardingTest(NOW);
        yield* activateOnboardingPrograms(test);
        if (existing) {
          yield* Effect.promise(() =>
            test.mutation((ctx) =>
              ctx.db.insert("onboardingProfiles", {
                userId: identity.userId,
                updatedAt: NOW - 1,
              })
            )
          );
        }
        const read = () =>
          test.query(async (ctx) => ({
            profile: await ctx.db.query("onboardingProfiles").unique(),
            preference: await ctx.db.query("learningPreferences").unique(),
            user: await ctx.db.get("users", identity.userId),
            jobs: await ctx.db.system.query("_scheduled_functions").collect(),
          }));
        const before = yield* Effect.promise(() => read());
        yield* Effect.promise(() =>
          expect(
            test.mutation((ctx) => {
              const insert = ctx.db.insert.bind(ctx.db);
              const replace = ctx.db.replace.bind(ctx.db);
              vi.spyOn(ctx.db, "insert").mockImplementation((name, value) =>
                name === table
                  ? Promise.reject(new Error("private write failure"))
                  : insert(name, value)
              );
              vi.spyOn(ctx.db, "replace").mockImplementation((id, value) =>
                ctx.db.normalizeId(table, id) === null
                  ? replace(id, value)
                  : Promise.reject(new Error("private write failure"))
              );
              const write = Effect.gen(function* () {
                if (operation === "admit") {
                  return yield* admitOnboarding({
                    _id: identity.userId,
                  });
                }
                if (operation === "save") {
                  return yield* saveOnboardingAnswer(identity.userId, {
                    kind: "role",
                    value: "student",
                  });
                }
                return yield* finishOnboarding(identity.userId, {
                  role: "student",
                  region: "indonesia",
                  focus: "learning",
                });
              });
              return Effect.runPromiseWith(runtimeServices)(
                write.pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
              );
            })
          ).rejects.toMatchObject({
            code: "ONBOARDING_PERSISTENCE_FAILED",
            message: "Unable to read or persist onboarding progress.",
          })
        );
        expect(yield* Effect.promise(() => read())).toEqual(before);
      })
  );
  it.live.each([
    {
      answer: {
        kind: "role",
        value: "teacher",
      } as const,
      expected: {
        role: "teacher",
        updatedAt: NOW,
      },
    },
    {
      answer: {
        kind: "region",
        value: "germany",
      } as const,
      expected: {
        region: "germany",
        updatedAt: NOW,
      },
    },
    {
      answer: {
        kind: "focus",
        value: "tryout",
      } as const,
      expected: {
        focus: "tryout",
        updatedAt: NOW,
      },
    },
  ])("accepts $answer.kind as the first draft answer", ({ answer, expected }) =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const { identity, test } = yield* createOnboardingTest(NOW);
      const saved = yield* Effect.promise(() =>
        test.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            saveOnboardingAnswer(identity.userId, answer).pipe(
              Effect.provide(mutationLayer(confectSchema, ctx))
            )
          )
        )
      );
      const stored = yield* Effect.promise(() =>
        test.query(async (ctx) => ({
          preference: await ctx.db.query("learningPreferences").unique(),
          profile: await ctx.db.query("onboardingProfiles").unique(),
          user: await ctx.db.get("users", identity.userId),
        }))
      );
      expect(saved).toEqual(expected);
      expect(stored.profile).toMatchObject({
        admittedAt: NOW,
        startedAt: NOW,
        ...expected,
      });
      expect(stored.preference).toBeNull();
      expect(stored.user?.role).toBeUndefined();
    })
  );
  it.live("updates every answer and starts an existing draft", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const { identity, test } = yield* createOnboardingTest(NOW);
      yield* Effect.promise(() =>
        test.mutation((ctx) =>
          ctx.db.insert("onboardingProfiles", {
            updatedAt: NOW - 1000,
            userId: identity.userId,
          })
        )
      );
      yield* Effect.promise(() =>
        test.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            saveOnboardingAnswer(identity.userId, {
              kind: "role",
              value: "parent",
            }).pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
          )
        )
      );
      yield* Effect.sync(() => vi.setSystemTime(NOW + 1000));
      yield* Effect.promise(() =>
        test.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            saveOnboardingAnswer(identity.userId, {
              kind: "region",
              value: "singapore",
            }).pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
          )
        )
      );
      yield* Effect.sync(() => vi.setSystemTime(NOW + 2000));
      const saved = yield* Effect.promise(() =>
        test.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            saveOnboardingAnswer(identity.userId, {
              kind: "focus",
              value: "learning",
            }).pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
          )
        )
      );
      const stored = yield* Effect.promise(() =>
        test.query((ctx) => ctx.db.query("onboardingProfiles").unique())
      );
      expect(saved).toEqual({
        focus: "learning",
        region: "singapore",
        role: "parent",
        updatedAt: NOW + 2000,
      });
      expect(stored).toMatchObject({
        admittedAt: NOW,
        startedAt: NOW,
        updatedAt: NOW + 2000,
      });
    })
  );
  it.live("records admission on an existing incomplete profile", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const { identity, test } = yield* createOnboardingTest(NOW);
      yield* Effect.promise(() =>
        test.mutation((ctx) =>
          ctx.db.insert("onboardingProfiles", {
            focus: "learning",
            updatedAt: NOW - 1000,
            userId: identity.userId,
          })
        )
      );
      const status = yield* Effect.promise(() =>
        test.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            admitOnboarding({
              _id: identity.userId,
            }).pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
          )
        )
      );
      const stored = yield* Effect.promise(() =>
        test.query((ctx) => ctx.db.query("onboardingProfiles").unique())
      );
      expect(status).toEqual({
        isAuthenticated: true,
        isRequired: true,
        profile: {
          focus: "learning",
          updatedAt: NOW - 1000,
        },
      });
      expect(stored?.admittedAt).toBe(NOW);
    })
  );
  it.live("rejects a draft write after completion", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const { identity, test } = yield* createOnboardingTest(NOW);
      yield* Effect.promise(() =>
        test.mutation((ctx) =>
          ctx.db.insert("onboardingProfiles", {
            completedAt: NOW,
            updatedAt: NOW,
            userId: identity.userId,
          })
        )
      );
      yield* Effect.promise(() =>
        expect(
          test.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              saveOnboardingAnswer(identity.userId, {
                kind: "focus",
                value: "tryout",
              }).pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
            )
          )
        ).rejects.toMatchObject({
          code: "ONBOARDING_ALREADY_COMPLETE",
          message: "Onboarding is already complete.",
        })
      );
    })
  );
  it.live("redacts a duplicate profile invariant failure", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const { identity, test } = yield* createOnboardingTest(NOW);
      yield* Effect.promise(() =>
        test.mutation(async (ctx) => {
          for (const updatedAt of [NOW - 2000, NOW - 1000]) {
            await ctx.db.insert("onboardingProfiles", {
              updatedAt,
              userId: identity.userId,
            });
          }
        })
      );
      yield* Effect.promise(() =>
        expect(
          test.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              saveOnboardingAnswer(identity.userId, {
                kind: "role",
                value: "student",
              }).pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
            )
          )
        ).rejects.toMatchObject({
          code: "ONBOARDING_PERSISTENCE_FAILED",
          message: "Unable to read or persist onboarding progress.",
        })
      );
    })
  );
  it.live("rejects a managed catalog without the region default", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const { identity, test } = yield* createOnboardingTest(NOW);
      const data = yield* makeProgramSnapshotData([makeTechnicalProgram(1)]);
      yield* Effect.promise(() =>
        test.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            activateProgramSnapshot(data).pipe(
              Effect.provide(mutationLayer(confectSchema, ctx))
            )
          )
        )
      );
      yield* Effect.promise(() =>
        expect(
          test.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              finishOnboarding(identity.userId, {
                focus: "learning",
                region: "indonesia",
                role: "student",
              }).pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
            )
          )
        ).rejects.toMatchObject({
          code: "ONBOARDING_CURRICULUM_MISSING",
          message: "The default curriculum is unavailable.",
        })
      );
    })
  );
  it.live("completes a resumed draft without rewriting its lifecycle", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const { identity, test } = yield* createOnboardingTest(NOW);
      yield* activateOnboardingPrograms(test);
      yield* Effect.promise(() =>
        test.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            saveOnboardingAnswer(identity.userId, {
              kind: "focus",
              value: "learning",
            }).pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
          )
        )
      );
      yield* Effect.sync(() => vi.setSystemTime(NOW + 1000));
      const result = yield* Effect.promise(() =>
        test.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            finishOnboarding(identity.userId, {
              focus: "learning",
              region: "germany",
              role: "teacher",
            }).pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
          )
        )
      );
      const stored = yield* Effect.promise(() =>
        test.query((ctx) => ctx.db.query("onboardingProfiles").unique())
      );
      expect(result).toEqual({
        destination: {
          kind: "curriculum-program",
          publicSlug: "cambridge",
        },
        locale: "de",
      });
      expect(stored).toMatchObject({
        admittedAt: NOW,
        completedAt: NOW + 1000,
        startedAt: NOW,
      });
    })
  );
  it.live(
    "normalizes lifecycle timestamps when completing a stored draft",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const { identity, test } = yield* createOnboardingTest(NOW);
        yield* activateOnboardingPrograms(test);
        yield* Effect.promise(() =>
          test.mutation((ctx) =>
            ctx.db.insert("onboardingProfiles", {
              focus: "learning",
              updatedAt: NOW - 1000,
              userId: identity.userId,
            })
          )
        );
        yield* Effect.promise(() =>
          test.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              finishOnboarding(identity.userId, {
                focus: "learning",
                region: "indonesia",
                role: "student",
              }).pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
            )
          )
        );
        const stored = yield* Effect.promise(() =>
          test.query((ctx) => ctx.db.query("onboardingProfiles").unique())
        );
        expect(stored).toMatchObject({
          admittedAt: NOW,
          completedAt: NOW,
          startedAt: NOW,
        });
      })
  );
});
