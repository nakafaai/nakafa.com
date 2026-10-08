import { Ref } from "@confect/core";
import { RegisteredConvexFunction } from "@confect/server";
import { assert, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { decodeArtifactJson } from "@repo/backend/confect/contentRelease/parse";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import type { TryoutHistoryRequest } from "@repo/backend/confect/tryouts/runtime/history/spec";
import { insertHistoryAttempt } from "@repo/backend/test/tryout/history";
import { TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";
import { Array as Arr, Effect, Option, Schema } from "effect";

const PlainJson = Schema.fromJsonString(Schema.Unknown);
const readReference = Ref.getFunctionReference(
  refs.public.tryouts.queries.content.getBatch
);
async function setup() {
  const t = createConvexTestWithBetterAuth();
  const seed = await t.mutation((ctx) => insertHistoryAttempt(ctx, true));
  const owned = t.withIdentity({
    subject: seed.identity.authUserId,
    sessionId: seed.identity.sessionId,
  });
  return {
    owned,
    seed,
    t,
  };
}
async function readFailure(
  t: Pick<ReturnType<typeof createConvexTestWithBetterAuth>, "query">,
  request: TryoutHistoryRequest
) {
  const failure = await t
    .query(readReference, request)
    .catch((error: unknown) => error);
  assert(Ref.isConvexError(failure));
  const decoded = Ref.decodeErrorOption(
    refs.public.tryouts.queries.content.getBatch,
    failure.data
  );
  assert(Option.isSome(decoded));
  return {
    code: decoded.value.code,
    message: decoded.value.message,
  };
}
beforeEach(() => vi.setSystemTime(new Date(TRYOUT_TEST_NOW)));
describe("tryouts/runtime/history/placement", () => {
  it("withholds a body hash that is not the frozen question or localized explanation", async () => {
    const { owned, seed } = await setup();
    expect(
      await owned.query(readReference, {
        ...seed.request,
        selectors: Arr.map(seed.request.selectors, (selector) => ({
          ...selector,
          artifactHash: `sha256:${"0".repeat(64)}`,
        })),
      })
    ).toBeNull();
  });
  it.each(["invalid", "missing"])(
    "withholds %s retained placement data",
    async (state) => {
      const { owned, seed, t } = await setup();
      await t.mutation(async (ctx) => {
        if (state === "missing") {
          await ctx.db.delete(seed.retainedId);
        } else {
          await ctx.db.patch(seed.retainedId, {
            questionOrder: Number.NaN,
          });
        }
      });
      const result = owned.query(readReference, seed.request);
      if (state === "missing") {
        await expect(result).rejects.toHaveProperty("data", {
          _tag: "TryoutHistoryError",
          code: "TRYOUT_HISTORY_INTEGRITY",
          message: "Try-out placement lost its original snapshot membership.",
        });
        return;
      }
      await expect(result).rejects.toHaveProperty("data", {
        _tag: "TryoutRuntimeError",
        code: "TRYOUT_RUNTIME_FAILED",
        message: "Unable to complete try-out runtime operation.",
      });
    }
  );
  it.effect(
    "withholds an unstarted or completed section during an active attempt",
    () =>
      Effect.gen(function* () {
        const { owned, seed, t } = yield* Effect.promise(setup);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            ctx.db.patch(seed.request.attemptId, {
              status: "in-progress",
            })
          )
        );
        assert.isNull(
          yield* Effect.promise(() => owned.query(readReference, seed.request))
        );
        yield* Effect.promise(() =>
          t.mutation((ctx) => ctx.db.delete(seed.sectionId))
        );
        assert.isNull(
          yield* Effect.promise(() => owned.query(readReference, seed.request))
        );
      })
  );
  it.effect(
    "gives a free learner only the answers of the section's leading questions",
    () =>
      Effect.gen(function* () {
        const { owned, seed, t } = yield* Effect.promise(setup);
        const answer = Option.getOrUndefined(
          Arr.findFirst(
            seed.request.selectors,
            (selector) => selector.delivery === "entitled"
          )
        );
        assert.isDefined(answer);
        const later = answer.questionOrder + 2;
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            await ctx.db.patch("users", seed.identity.userId, {
              plan: "free",
            });
            const placement = await ctx.db.get(seed.placementId);
            assert.isNotNull(placement);
            const { _creationTime, _id, ...frozen } = placement;
            for (const questionOrder of [answer.questionOrder + 1, later]) {
              await ctx.db.insert("tryoutAttemptPlacements", {
                ...frozen,
                questionOrder,
              });
            }
          })
        );
        assert.isNotNull(
          yield* Effect.promise(() => owned.query(readReference, seed.request))
        );
        assert.isNull(
          yield* Effect.promise(() =>
            owned.query(readReference, {
              ...seed.request,
              selectors: [{ ...answer, questionOrder: later }],
            })
          )
        );
      })
  );
  it.effect(
    "keeps the free preview on the leading positions when a placement is missing",
    () =>
      Effect.gen(function* () {
        const { owned, seed, t } = yield* Effect.promise(setup);
        const answer = Option.getOrUndefined(
          Arr.findFirst(
            seed.request.selectors,
            (selector) => selector.delivery === "entitled"
          )
        );
        assert.isDefined(answer);
        const second = answer.questionOrder + 1;
        const third = answer.questionOrder + 2;
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            await ctx.db.patch("users", seed.identity.userId, {
              plan: "free",
            });
            const placement = await ctx.db.get(seed.placementId);
            const retained = await ctx.db.get(seed.retainedId);
            assert.isNotNull(placement);
            assert.isNotNull(retained);
            const { _creationTime, _id, ...frozen } = placement;
            const {
              _creationTime: _retainedCreationTime,
              _id: _retainedId,
              ...catalog
            } = retained;
            // Each later question is a genuine placement with its own
            // retained snapshot row, so only the preview gate can withhold it.
            for (const questionOrder of [second, third]) {
              const identity = `${catalog.identity}:${questionOrder}`;
              await ctx.db.insert("tryoutPlacements", {
                ...catalog,
                identity,
                questionOrder,
              });
              await ctx.db.insert("tryoutAttemptPlacements", {
                ...frozen,
                placementIdentity: identity,
                questionOrder,
              });
            }
            await ctx.db.delete(seed.placementId);
          })
        );
        assert.isNotNull(
          yield* Effect.promise(() =>
            owned.query(readReference, {
              ...seed.request,
              selectors: [{ ...answer, questionOrder: second }],
            })
          )
        );
        assert.isNull(
          yield* Effect.promise(() =>
            owned.query(readReference, {
              ...seed.request,
              selectors: [{ ...answer, questionOrder: third }],
            })
          )
        );
      })
  );
  it.effect("withholds every answer while its section is in progress", () =>
    Effect.gen(function* () {
      const { owned, seed, t } = yield* Effect.promise(setup);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          await ctx.db.patch(seed.request.attemptId, {
            status: "in-progress",
          });
          await ctx.db.patch(seed.sectionId, { status: "in-progress" });
        })
      );
      assert.isNull(
        yield* Effect.promise(() =>
          owned.query(readReference, {
            ...seed.request,
            selectors: Arr.filter(
              seed.request.selectors,
              (selector) => selector.delivery === "entitled"
            ),
          })
        )
      );
    })
  );
  it.effect(
    "rejects section state that no longer belongs to the frozen section",
    () =>
      Effect.gen(function* () {
        const { owned, seed, t } = yield* Effect.promise(setup);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            ctx.db.patch(seed.sectionId, {
              sectionIdentity: "foreign-section",
            })
          )
        );
        const error = yield* Effect.promise(() =>
          readFailure(owned, seed.request)
        );
        assert.deepStrictEqual(error, {
          code: "TRYOUT_HISTORY_INTEGRITY",
          message: "Try-out section lost its frozen identity.",
        });
      })
  );
  it.effect("rejects a missing original artifact", () =>
    Effect.gen(function* () {
      const { owned, seed, t } = yield* Effect.promise(setup);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const artifact = await ctx.db
            .query("contentArtifacts")
            .withIndex("by_artifactHash", (index) =>
              index.eq("artifactHash", seed.fixture.question.artifactHash)
            )
            .unique();
          assert.isNotNull(artifact);
          await ctx.db.delete(artifact._id);
        })
      );
      const error = yield* Effect.promise(() =>
        readFailure(owned, seed.request)
      );
      assert.deepStrictEqual(error, {
        code: "TRYOUT_HISTORY_INTEGRITY",
        message: "Try-out placement lost its signed body.",
      });
    })
  );
  it.effect("rejects a stored artifact reassigned to another locale", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const { owned, seed, t } = yield* Effect.promise(setup);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const stored = await ctx.db
            .query("contentArtifacts")
            .withIndex("by_artifactHash", (index) =>
              index.eq("artifactHash", seed.fixture.question.artifactHash)
            )
            .unique();
          assert.isNotNull(stored);
          const artifact = await Effect.runPromiseWith(runtimeServices)(
            decodeArtifactJson(stored.artifactJson).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          );
          await ctx.db.patch(stored._id, {
            artifactJson: Schema.encodeSync(PlainJson)({
              ...artifact,
              payload: {
                ...artifact.payload,
                artifactLocale: "id",
              },
            }),
          });
        })
      );
      const error = yield* Effect.promise(() =>
        readFailure(owned, seed.request)
      );
      assert.deepStrictEqual(error, {
        code: "TRYOUT_HISTORY_INTEGRITY",
        message: "Try-out body changed its frozen identity.",
      });
    })
  );
});
