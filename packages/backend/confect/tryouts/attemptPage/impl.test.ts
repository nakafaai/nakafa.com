import { assert, describe, expect, it } from "@effect/vitest";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { seedAuthenticatedUser } from "@repo/backend/confect/test.helpers";
import type {
  tryoutSectionAttemptPageResultValidator,
  tryoutSetAttemptPageResultValidator,
} from "@repo/backend/confect/tryouts/attemptPage/spec";
import { TryoutQuestionBodyText } from "@repo/backend/confect/tryouts/runtime/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { client } from "@repo/backend/test/client";
import {
  startArgs,
  TRYOUT_NOW,
  type TryoutWorld,
  tryoutWorld,
} from "@repo/backend/test/tryout/world";
import { Array as Arr, Effect, Schema } from "effect";

const SET_PATH = "try-out/indonesia/snbt/2027/set-1-id";

/** The current-attempt request of the fixture set, or of one of its sections. */
const current = (locale: "en" | "id" = "id") => ({
  ...startArgs({ locale }),
  kind: "current" as const,
});

/** The retained-attempt request of one attempt at one route. */
const retained = (
  attemptId: string,
  publicPath: string,
  locale: "en" | "id" = "id"
) => ({ attemptId, kind: "retained" as const, locale, publicPath });

/** Decodes the bodies a page that is not a redirect carries, in question order. */
const bodiesOf = (
  page:
    | typeof tryoutSectionAttemptPageResultValidator.Type
    | typeof tryoutSetAttemptPageResultValidator.Type
) => {
  assert.ok(page && page.kind !== "redirect", "Expected a page with content.");
  return Effect.forEach(page.content, ({ body }) =>
    Schema.decodeEffect(TryoutQuestionBodyText)(body)
  );
};

/** Sits and completes both sections of the fixture set. */
const finishSet = (world: TryoutWorld, attemptId: Id<"tryoutAttempts">) =>
  Effect.gen(function* () {
    yield* world.startSection(attemptId, "section-a");
    yield* world.answer(attemptId, {
      order: 1,
      pick: "correct",
      section: "section-a",
    });
    yield* world.completeSection(attemptId, "section-a");
    yield* world.startSection(attemptId, "section-b");
    yield* world.completeSection(attemptId, "section-b");
  });

/** Deletes the catalog rows of an attempt's set from one snapshot in one locale. */
const dropSet = (
  world: TryoutWorld,
  attemptId: Id<"tryoutAttempts">,
  snapshotId: string,
  appLocale: "en" | "id"
) =>
  Effect.promise(() =>
    world.t.mutation(async (ctx) => {
      const attempt = await ctx.db.get("tryoutAttempts", attemptId);
      assert.ok(attempt, "Expected the attempt.");
      for (const row of await ctx.db
        .query("assessmentRows")
        .withIndex(
          "by_snapshotId_and_setIdentity_and_appLocale_and_order",
          (query) =>
            query
              .eq("snapshotId", snapshotId)
              .eq("setIdentity", attempt.setIdentity)
              .eq("appLocale", appLocale)
        )
        .collect()) {
        await ctx.db.delete("assessmentRows", row._id);
      }
    })
  );

describe("tryouts/attemptPage", () => {
  it.effect(
    "shows nothing to a visitor, nor before the learner's first attempt",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        for (const caller of [world.visitor, world.learner]) {
          expect(
            yield* caller.query(tryouts.queries.attemptPage.getSet, {
              request: current(),
            })
          ).toBeNull();
          expect(
            yield* caller.query(tryouts.queries.attemptPage.getSection, {
              request: { ...current(), sectionKey: "section-a" },
            })
          ).toBeNull();
        }
      })
  );

  it.effect(
    "redirects a current set or section page to the running attempt's route in the requested locale",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const { attemptId } = yield* world.start();
        expect(
          yield* world.learner.query(tryouts.queries.attemptPage.getSet, {
            request: current("en"),
          })
        ).toEqual({
          attemptId,
          kind: "redirect",
          publicPath: "try-out/indonesia/snbt/2027/set-1-en",
        });
        expect(
          yield* world.learner.query(tryouts.queries.attemptPage.getSection, {
            request: { ...current(), sectionKey: "section-b" },
          })
        ).toEqual({
          attemptId,
          kind: "redirect",
          publicPath: `${SET_PATH}/section-b`,
        });
        expect(
          yield* world.learner.query(tryouts.queries.attemptPage.getSection, {
            request: { ...current(), sectionKey: "section-z" },
          })
        ).toBeNull();
      })
  );

  it.effect(
    "shows a finished set page with its frozen catalog, and reviews a section with the free preview's keys and explanations",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const { attemptId } = yield* world.start();
        yield* finishSet(world, attemptId);
        const set = yield* world.learner.query(
          tryouts.queries.attemptPage.getSet,
          { request: current() }
        );
        expect(set).toMatchObject({
          attemptId,
          content: [],
          initialState: {
            attempt: {
              attemptId,
              completedSectionKeys: ["section-a", "section-b"],
              status: "completed",
            },
          },
          kind: "current",
          page: {
            entrySection: { sectionKey: "section-a", visibility: "visible" },
            sections: [
              {
                questionCount: 2,
                sectionKey: "section-a",
                timeLimitSeconds: 600,
              },
              {
                questionCount: 1,
                sectionKey: "section-b",
                timeLimitSeconds: 300,
              },
            ],
            set: { publicPath: SET_PATH, questionCount: 3, sectionCount: 2 },
          },
          restartTarget: {
            entrySection: { publicPath: `${SET_PATH}/section-a` },
            setPublicPath: SET_PATH,
          },
        });
        expect(
          yield* world.learner.query(tryouts.queries.attemptPage.getSection, {
            request: { ...current(), sectionKey: "section-b" },
          })
        ).toBeNull();
        const section = yield* world.learner.query(
          tryouts.queries.attemptPage.getSection,
          { request: retained(attemptId, `${SET_PATH}/section-b`) }
        );
        expect(section).toMatchObject({
          activeSectionPublicPath: `${SET_PATH}/section-b`,
          activeSetPublicPath: SET_PATH,
          attemptId,
          kind: "retained",
          page: { section: { sectionKey: "section-b" } },
        });
        const [table] = yield* bodiesOf(section);
        expect(table).toMatchObject({
          explanation: { type: "doc" },
          interaction: { kind: "matrix" },
          key: { kind: "matrix" },
          prompt: { type: "doc" },
          stimulus: { type: "doc" },
        });
      })
  );

  it.effect(
    "offers no restart once the active release drops the set, and no page in a locale the attempt's snapshot lost",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const { attemptId } = yield* world.start();
        yield* finishSet(world, attemptId);
        const next = yield* world.release({ renamed: true });
        yield* dropSet(world, attemptId, next.snapshotId, "id");
        expect(
          yield* world.learner.query(tryouts.queries.attemptPage.getSet, {
            request: retained(attemptId, SET_PATH),
          })
        ).toMatchObject({
          kind: "retained",
          page: { set: { publicPath: SET_PATH } },
          restartTarget: null,
        });
        yield* dropSet(world, attemptId, world.snapshotId, "en");
        expect(
          yield* world.learner.query(tryouts.queries.attemptPage.getSet, {
            request: retained(attemptId, SET_PATH, "en"),
          })
        ).toBeNull();
        expect(
          yield* world.learner.query(tryouts.queries.attemptPage.getSection, {
            request: retained(attemptId, `${SET_PATH}/section-b`, "en"),
          })
        ).toBeNull();
      })
  );

  it.effect(
    "gives a Pro learner every answer of a finished section in the page's locale",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        yield* Effect.promise(() =>
          world.t.mutation((ctx) =>
            ctx.db.patch("users", world.userId, { plan: "pro" })
          )
        );
        const { attemptId } = yield* world.start();
        yield* finishSet(world, attemptId);
        const section = yield* world.learner.query(
          tryouts.queries.attemptPage.getSection,
          {
            request: retained(
              attemptId,
              "try-out/indonesia/snbt/2027/set-1-en/section-a",
              "en"
            ),
          }
        );
        const bodies = yield* bodiesOf(section);
        expect(
          Arr.map(bodies, (body) => [body.key?.kind, body.explanation?.type])
        ).toEqual([
          ["choice", "doc"],
          ["choice", "doc"],
        ]);
      })
  );

  it.effect(
    "shows a running direct-entry attempt's entry section without answers, and refuses a retained page it does not own",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld({ entry: true });
        const { attemptId } = yield* world.start({ entry: true });
        const page = yield* world.learner.query(
          tryouts.queries.attemptPage.getSet,
          { request: retained(attemptId, SET_PATH) }
        );
        expect(page).toMatchObject({
          kind: "retained",
          page: { entrySection: { sectionKey: "section-a" } },
          restartTarget: {
            entrySection: {
              sectionKey: "section-a",
              visibility: "internal-entry",
            },
            setPublicPath: SET_PATH,
          },
        });
        const bodies = yield* bodiesOf(page);
        expect(Arr.map(bodies, (body) => body.interaction.kind)).toEqual([
          "choice",
          "choice",
        ]);
        expect(Arr.some(bodies, (body) => body.key !== undefined)).toBe(false);
        const other = yield* Effect.promise(() =>
          world.t.mutation((ctx) =>
            seedAuthenticatedUser(ctx, { now: TRYOUT_NOW, suffix: "other" })
          )
        );
        const otherLearner = client(
          world.t.withIdentity({
            sessionId: other.sessionId,
            subject: other.authUserId,
          })
        );
        for (const request of [
          retained(attemptId, SET_PATH),
          retained("not-an-id", SET_PATH),
        ]) {
          expect(
            yield* otherLearner.query(tryouts.queries.attemptPage.getSet, {
              request,
            })
          ).toBeNull();
          expect(
            yield* otherLearner.query(tryouts.queries.attemptPage.getSection, {
              request,
            })
          ).toBeNull();
        }
        expect(
          yield* world.learner.query(tryouts.queries.attemptPage.getSet, {
            request: retained(attemptId, "try-out/elsewhere"),
          })
        ).toBeNull();
        expect(
          yield* world.learner.query(tryouts.queries.attemptPage.getSection, {
            request: retained(attemptId, "try-out/elsewhere"),
          })
        ).toBeNull();
      })
  );
});
