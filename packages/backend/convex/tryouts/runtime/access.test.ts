import { beforeEach, describe, expect, it, vi } from "@effect/vitest";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { readOwnedTryoutSectionContent } from "@repo/backend/convex/tryouts/runtime/access";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import {
  TRYOUT_SECTION_KEY,
  TRYOUT_TEST_NOW,
} from "@repo/backend/test/tryouts";
import { Effect } from "effect";

beforeEach(() => {
  vi.setSystemTime(new Date(TRYOUT_TEST_NOW));
});

describe("tryouts/runtime/access", () => {
  it.effect("returns signed questions for the active section", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          seedTryoutContentAccessState(ctx, {
            attemptStatus: "in-progress",
            sectionStatus: "in-progress",
            suffix: "content-active",
          })
        )
      );

      const content = yield* Effect.promise(() =>
        t.query((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const attempt = yield* Effect.promise(() =>
                ctx.db.get(seeded.attemptId)
              );
              if (!attempt) {
                return yield* Effect.die(
                  new Error("Expected an attempt fixture.")
                );
              }
              return yield* readOwnedTryoutSectionContent(ctx, {
                attempt,
                appLocale: "id",
                sectionKey: TRYOUT_SECTION_KEY,
              });
            })
          )
        )
      );

      expect(content).toEqual({
        answers: [],
        kind: "signed",
        questions: [seeded.signedContent.question],
        runtime: "current",
      });
    })
  );

  it.effect("returns signed answers for a resolved terminal attempt", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          seedTryoutContentAccessState(ctx, {
            attemptStatus: "completed",
            sectionStatus: "completed",
            suffix: "content-terminal",
          })
        )
      );

      const content = yield* Effect.promise(() =>
        t.query((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const attempt = yield* Effect.promise(() =>
                ctx.db.get(seeded.attemptId)
              );
              if (!attempt) {
                return yield* Effect.die(
                  new Error("Expected an attempt fixture.")
                );
              }
              return yield* readOwnedTryoutSectionContent(ctx, {
                attempt,
                appLocale: "id",
                sectionKey: TRYOUT_SECTION_KEY,
              });
            })
          )
        )
      );

      expect(content).toEqual({
        answers: [seeded.signedContent.answer],
        kind: "signed",
        questions: [seeded.signedContent.question],
        runtime: "current",
      });
    })
  );

  it.effect("maps duplicate section state into a typed read failure", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const fixture = yield* Effect.promise(() =>
                seedTryoutContentAccessState(ctx, {
                  attemptStatus: "in-progress",
                  sectionStatus: "in-progress",
                  suffix: "content-duplicate-section",
                })
              );
              const section = yield* Effect.promise(() =>
                ctx.db.get(fixture.sectionAttemptId)
              );
              if (!section) {
                return yield* Effect.die(
                  new Error("Expected a section attempt fixture.")
                );
              }
              yield* Effect.promise(() =>
                ctx.db.insert("tryoutSectionAttempts", {
                  answeredCount: section.answeredCount,
                  completedAt: section.completedAt,
                  correctAnswers: section.correctAnswers,
                  endReason: section.endReason,
                  expiresAt: section.expiresAt,
                  lastActivityAt: section.lastActivityAt,
                  score: section.score,
                  sectionIdentity: section.sectionIdentity,
                  sectionKey: section.sectionKey,
                  sectionOrder: section.sectionOrder,
                  startedAt: section.startedAt,
                  status: section.status,
                  totalQuestions: section.totalQuestions,
                  tryoutAttemptId: section.tryoutAttemptId,
                })
              );
              return fixture;
            })
          )
        )
      );

      yield* Effect.promise(() =>
        expect(
          t.query((ctx) =>
            runConvexProgram(
              Effect.gen(function* () {
                const attempt = yield* Effect.promise(() =>
                  ctx.db.get(seeded.attemptId)
                );
                if (!attempt) {
                  return yield* Effect.die(
                    new Error("Expected an attempt fixture.")
                  );
                }
                return yield* readOwnedTryoutSectionContent(ctx, {
                  attempt,
                  appLocale: "id",
                  sectionKey: TRYOUT_SECTION_KEY,
                });
              })
            )
          )
        ).rejects.toThrow("Unable to read try-out content access.")
      );
    })
  );
});
