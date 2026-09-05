import { describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import {
  readAttemptSectionPage,
  readAttemptSetPage,
} from "@repo/backend/convex/tryouts/runtime/attempt/page";
import { readAttemptSetIdentity } from "@repo/backend/convex/tryouts/runtime/lookup";
import {
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_NOW,
  TRYOUT_START_SECTION,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout/source";
import { seedTryoutStartSet } from "@repo/backend/test/tryout/start";
import type { WithoutSystemFields } from "convex/server";
import { Effect, Struct } from "effect";

const identity = {
  countryKey: TRYOUT_START_COUNTRY,
  examKey: TRYOUT_START_EXAM,
  locale: "id" as const,
  setKey: TRYOUT_START_SET,
  trackKey: TRYOUT_START_TRACK,
};
const setPath = `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}/${TRYOUT_START_SET}`;
const sectionPath = `${setPath}/${TRYOUT_START_SECTION}`;

const startFixture = Effect.fn("frozenPage.test.startFixture")(function* () {
  vi.setSystemTime(new Date(TRYOUT_START_NOW));
  const t = createConvexTestWithBetterAuth();
  const auth = yield* Effect.promise(() =>
    t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_START_NOW,
        suffix: "frozen-page-integrity",
      });
      await seedTryoutStartSet(ctx, {
        userId: user.userId,
        visibility: "visible",
      });
      return user;
    })
  );
  const client = t.withIdentity({
    subject: auth.authUserId,
    sessionId: auth.sessionId,
  });
  const started = yield* Effect.promise(() =>
    client.mutation(api.tryouts.mutations.attempts.startAttempt, identity)
  );
  const original = yield* Effect.promise(() =>
    t.query((ctx) => ctx.db.get(started.attemptId))
  );
  if (original === null) {
    return yield* Effect.die("Expected one persisted frozen attempt.");
  }
  return { original, t };
});

describe("frozen try-out page integrity", () => {
  it.effect(
    "projects exact set and section routes and rejects another route kind",
    () =>
      Effect.gen(function* () {
        const { original, t } = yield* startFixture();
        const set = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(
              readAttemptSetPage(
                ctx,
                { locale: "id", publicPath: setPath },
                original,
                identity
              )
            )
          )
        );
        expect(set.set).toMatchObject({
          publicPath: original.setPublicPath,
          totalQuestionCount: original.totalQuestions,
        });
        expect(set.sections.map(({ sectionKey }) => sectionKey)).toEqual([
          TRYOUT_START_SECTION,
        ]);
        const section = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(
              readAttemptSectionPage(
                ctx,
                { locale: "id", publicPath: sectionPath },
                original
              )
            )
          )
        );
        expect(section.section).toMatchObject({
          publicPath: sectionPath,
          sectionKey: TRYOUT_START_SECTION,
        });
        for (const publicPath of [sectionPath, `${setPath}-missing`]) {
          yield* Effect.promise(() =>
            expect(
              t.query((ctx) =>
                runConvexProgram(
                  readAttemptSetPage(
                    ctx,
                    { locale: "id", publicPath },
                    original,
                    identity
                  )
                )
              )
            ).rejects.toMatchObject({
              data: { code: "TRYOUT_SECTION_SNAPSHOT_MISMATCH" },
            })
          );
        }
        yield* Effect.promise(() =>
          expect(
            t.query((ctx) =>
              runConvexProgram(
                readAttemptSectionPage(
                  ctx,
                  { locale: "id", publicPath: setPath },
                  original
                )
              )
            )
          ).rejects.toMatchObject({
            data: { code: "TRYOUT_SECTION_SNAPSHOT_MISMATCH" },
          })
        );
      })
  );

  it.effect(
    "rejects persisted set identity, count, scoring, and section snapshot drift",
    () =>
      Effect.gen(function* () {
        const { original, t } = yield* startFixture();
        const patches: Partial<WithoutSystemFields<Doc<"tryoutAttempts">>>[] = [
          { appLocale: "en" },
          { setIdentity: "set:drift" },
          { setPublicPath: `${setPath}-drift` },
          { totalQuestions: original.totalQuestions + 1 },
          { scoringStrategy: "irt" },
          { sectionSnapshots: [] },
          ...[
            { sectionIdentity: "section:missing" },
            { sectionRowHash: "hash:drift" },
            { sectionOrder: 2 },
            { publicPath: `${sectionPath}-drift` },
            { questionCount: 2 },
            {
              questionSourcePath: "packages/corpus/question-bank/tryout/drift",
            },
            { sectionKey: "other" },
            { sourceRevision: "other" },
            { timeLimitSeconds: 1 },
          ].map((patch) => ({
            sectionSnapshots: original.sectionSnapshots.map((snapshot) => ({
              ...snapshot,
              ...patch,
            })),
          })),
        ];
        for (const patch of patches) {
          yield* Effect.promise(() =>
            t.mutation((ctx) =>
              ctx.db.patch(original._id, {
                ...Struct.omit(original, ["_id", "_creationTime"]),
                ...patch,
              })
            )
          );
          yield* Effect.promise(() =>
            expect(
              t.query(async (ctx) => {
                const attempt = await ctx.db.get(original._id);
                if (attempt === null) {
                  return null;
                }
                return runConvexProgram(
                  readAttemptSetPage(
                    ctx,
                    { locale: "id", publicPath: setPath },
                    attempt,
                    readAttemptSetIdentity(attempt)
                  )
                );
              })
            ).rejects.toMatchObject({
              data: { code: "TRYOUT_SECTION_SNAPSHOT_MISMATCH" },
            })
          );
        }
      })
  );
});
