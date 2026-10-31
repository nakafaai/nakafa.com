import { assert, describe, expect, it } from "@effect/vitest";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { seedAuthenticatedUser } from "@repo/backend/confect/test.helpers";
import {
  readLatestProgressAttempt,
  readOwnedAttemptById,
} from "@repo/backend/confect/tryouts/runtime/lookup";
import { TryoutQuestionBodyText } from "@repo/backend/confect/tryouts/runtime/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { FIXTURE_TRACK } from "@repo/backend/test/assessment/snapshot";
import { TRYOUT_NOW, tryoutWorld } from "@repo/backend/test/tryout/world";
import { Array as Arr, Effect, Schema, Struct } from "effect";

const identity = { ...FIXTURE_TRACK, setKey: "set-1" };
const setPath = "try-out/indonesia/snbt/2027/set-1-id";
const LOCALES = ["en", "de", "id"] as const;

describe("locale-neutral attempt ownership", () => {
  it.effect(
    "resumes, reviews and paginates the same history after every language change",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld({ entry: true });
        yield* Effect.promise(() =>
          world.t.mutation((ctx) =>
            ctx.db.patch("users", world.userId, { plan: "pro" })
          )
        );
        const first = yield* world.start({ entry: true });
        for (const locale of LOCALES) {
          expect((yield* world.start({ locale })).attemptId).toBe(
            first.attemptId
          );
          expect(
            yield* world.learner.query(tryouts.queries.attemptPage.getSet, {
              request: { ...identity, kind: "current", locale },
            })
          ).toMatchObject({ attemptId: first.attemptId, kind: "redirect" });
        }
        yield* world.completeSection(first.attemptId, "section-a");
        for (const locale of LOCALES) {
          const page = yield* world.learner.query(
            tryouts.queries.attemptPage.getSet,
            {
              request: {
                attemptId: first.attemptId,
                kind: "retained",
                locale,
                publicPath: setPath,
              },
            }
          );
          expect(page).toMatchObject({
            attemptId: first.attemptId,
            kind: "retained",
          });
          assert.ok(page?.kind === "retained", "Expected the retained page.");
          const bodies = yield* Effect.forEach(page.content, ({ body }) =>
            Schema.decodeEffect(TryoutQuestionBodyText)(body)
          );
          expect(bodies).toMatchObject(
            Arr.map([1, 2], (order) => ({
              explanation: {
                content: [
                  {
                    content: [
                      { text: `Pembahasan section-a-item-${order} ${locale}` },
                    ],
                  },
                ],
              },
              key: { kind: "choice" },
            }))
          );
          expect(
            yield* world.learner.query(tryouts.queries.attemptPage.getSet, {
              request: { ...identity, kind: "current", locale },
            })
          ).toMatchObject({ attemptId: first.attemptId, kind: "current" });
        }
        vi.setSystemTime(TRYOUT_NOW + 10_000);
        const second = yield* world.start({ locale: "en" });
        expect(second.attemptId).not.toBe(first.attemptId);
        const stored = yield* Effect.promise(() =>
          world.t.query(async (ctx) => ({
            attempt: await ctx.db.get("tryoutAttempts", second.attemptId),
            progress: await ctx.db.query("tryoutSetProgress").collect(),
          }))
        );
        expect(stored.attempt).toMatchObject({
          appLocale: "en",
          attemptNumber: 2,
        });
        expect(stored.progress).toEqual([
          expect.objectContaining({
            appLocale: "en",
            attemptNumber: 2,
            latestAttemptId: second.attemptId,
          }),
        ]);
        for (const locale of LOCALES) {
          const firstPage = yield* world.learner.query(
            tryouts.queries.history.bySet,
            {
              ...identity,
              locale,
              paginationOpts: { cursor: null, numItems: 1 },
            }
          );
          expect(Arr.map(firstPage.page, (row) => row.attemptId)).toEqual([
            second.attemptId,
          ]);
          const secondPage = yield* world.learner.query(
            tryouts.queries.history.bySet,
            {
              ...identity,
              locale,
              paginationOpts: {
                cursor: firstPage.continueCursor,
                numItems: 1,
              },
            }
          );
          expect(Arr.map(secondPage.page, (row) => row.attemptId)).toEqual([
            first.attemptId,
          ]);
        }
      })
  );

  it.effect(
    "fails closed when the set's progress no longer describes its latest attempt, and reads no attempt another learner owns",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const { attemptId } = yield* world.start();
        const other = yield* Effect.promise(() =>
          world.t.mutation((ctx) =>
            seedAuthenticatedUser(ctx, { now: TRYOUT_NOW, suffix: "other" })
          )
        );
        const latest = world.run(
          readLatestProgressAttempt(
            { ...identity, locale: "id" },
            world.userId
          ).pipe(
            Effect.map((attempt) => attempt?._id ?? null),
            Effect.catchTag("TryoutRuntimeError", ({ code }) =>
              Effect.succeed(code)
            )
          )
        );
        expect(yield* latest).toBe(attemptId);
        const changes: readonly ((ctx: MutationCtx) => Promise<unknown>)[] = [
          (ctx) =>
            ctx.db.patch("tryoutAttempts", attemptId, { examKey: "utbk" }),
          (ctx) =>
            ctx.db.patch("tryoutAttempts", attemptId, { userId: other.userId }),
          (ctx) =>
            ctx.db.patch("tryoutAttempts", attemptId, { appLocale: "en" }),
          (ctx) =>
            ctx.db.patch("tryoutAttempts", attemptId, { setIdentity: "set-9" }),
          (ctx) =>
            ctx.db.patch("tryoutAttempts", attemptId, { attemptNumber: 2 }),
          (ctx) =>
            ctx.db.patch("tryoutAttempts", attemptId, { status: "completed" }),
          async (ctx) => {
            const [progress] = await ctx.db
              .query("tryoutSetProgress")
              .collect();
            assert.ok(progress, "Expected the set's progress.");
            await ctx.db.patch("tryoutSetProgress", progress._id, {
              statusRank: 2,
            });
          },
          (ctx) => ctx.db.delete("tryoutAttempts", attemptId),
        ];
        for (const change of changes) {
          const saved = yield* Effect.promise(() =>
            world.t.query(async (ctx) => ({
              attempt: await ctx.db.get("tryoutAttempts", attemptId),
              progress: await ctx.db.query("tryoutSetProgress").collect(),
            }))
          );
          yield* Effect.promise(() => world.t.mutation(change));
          expect(yield* latest).toBe("TRYOUT_PROGRESS_ATTEMPT_MISMATCH");
          yield* Effect.promise(() =>
            world.t.mutation(async (ctx) => {
              assert.ok(saved.attempt, "Expected the saved attempt.");
              if (await ctx.db.get("tryoutAttempts", attemptId)) {
                await ctx.db.replace(
                  "tryoutAttempts",
                  attemptId,
                  Struct.omit(saved.attempt, ["_creationTime", "_id"])
                );
              }
              for (const progress of saved.progress) {
                await ctx.db.replace(
                  "tryoutSetProgress",
                  progress._id,
                  Struct.omit(progress, ["_creationTime", "_id"])
                );
              }
            })
          );
        }
        expect(
          yield* world.run(readOwnedAttemptById(attemptId, other.userId))
        ).toBeNull();
      })
  );
});
