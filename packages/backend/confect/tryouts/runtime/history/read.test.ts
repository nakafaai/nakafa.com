import { Ref } from "@confect/core";
import { assert, beforeEach, describe, it } from "@effect/vitest";
import {
  MAX_PROTECTED_RUNTIME_REQUEST_BYTES,
  MAX_PROTECTED_RUNTIME_SELECTORS,
} from "@nakafa/aksara-contracts/runtime/protected/limits";
import refs from "@repo/backend/confect/_generated/refs";
import { decodeCurrentSnapshotRowJson } from "@repo/backend/confect/contentRelease/parse";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import type { TryoutHistoryRequest } from "@repo/backend/confect/tryouts/runtime/history/spec";
import { insertHistoryAttempt } from "@repo/backend/test/tryout/history";
import { TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";
import { Effect, Option } from "effect";

const readReference = Ref.getFunctionReference(
  refs.public.tryouts.queries.content.getBatch
);
type Harness = Pick<ReturnType<typeof createConvexTestWithBetterAuth>, "query">;
function read(t: Harness, request: TryoutHistoryRequest) {
  return t
    .query(readReference, request)
    .then((value) =>
      Ref.decodeReturnsSync(refs.public.tryouts.queries.content.getBatch, value)
    );
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
async function setup(historical = false) {
  const t = createConvexTestWithBetterAuth();
  const seed = await t.mutation((ctx) => insertHistoryAttempt(ctx, historical));
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
beforeEach(() => vi.setSystemTime(new Date(TRYOUT_TEST_NOW)));
describe("tryouts/runtime/history/read", () => {
  it.effect(
    "requires current Pro access for answers beyond the free preview",
    () =>
      Effect.gen(function* () {
        const { owned, seed, t } = yield* Effect.promise(() => setup());
        const answer = seed.request.selectors.find(
          (selector) => selector.delivery === "entitled"
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
        const laterAnswer = {
          ...seed.request,
          selectors: [{ ...answer, questionOrder: later }],
        };
        // The first question sits in the free preview, questions stay free.
        const freeResult = yield* Effect.promise(() =>
          read(owned, seed.request)
        );
        assert.isNotNull(freeResult);
        assert.deepStrictEqual(
          freeResult.items.map((item) => item.delivery),
          ["authenticated", "entitled"]
        );
        assert.isNull(yield* Effect.promise(() => read(owned, laterAnswer)));
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            ctx.db.patch("users", seed.identity.userId, {
              plan: "pro",
            })
          )
        );
        assert.isNotNull(
          yield* Effect.promise(() => read(owned, seed.request))
        );
      })
  );
  it.effect("preserves old signed bytes after active release compaction", () =>
    Effect.gen(function* () {
      const { owned, seed, t } = yield* Effect.promise(() => setup(true));
      const retained = yield* Effect.promise(() =>
        t.query((ctx) => ctx.db.get(seed.retainedId))
      );
      assert.isNotNull(retained);
      assert.strictEqual(
        (yield* decodeCurrentSnapshotRowJson(retained.rowJson).pipe(
          Effect.flip
        )).code,
        "CONTENT_RELEASE_INTEGRITY"
      );
      const result = yield* Effect.promise(() => read(owned, seed.request));
      assert.isNotNull(result);
      assert.strictEqual(result.bundleJson, seed.runtime.bundleJson);
      assert.strictEqual(result.rendererJson, seed.runtime.rendererJson);
      assert.deepStrictEqual(
        result.items.map((item) => item.delivery),
        ["authenticated", "entitled"]
      );
      for (const [index, selector] of seed.request.selectors.entries()) {
        const stored = yield* Effect.promise(() =>
          t.query((ctx) =>
            ctx.db
              .query("contentArtifacts")
              .withIndex("by_artifactHash", (index) =>
                index.eq("artifactHash", selector.artifactHash)
              )
              .unique()
          )
        );
        assert.isNotNull(stored);
        assert.strictEqual(
          result.items[index]?.artifactJson,
          stored.artifactJson
        );
      }
    })
  );
  it.effect(
    "keeps the attempt release separate from a reused permanent bundle",
    () =>
      Effect.gen(function* () {
        const { owned, seed, t } = yield* Effect.promise(() => setup(true));
        const snapshotReleaseId = "newer-attempt-release";
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            ctx.db.patch(seed.request.attemptId, {
              snapshotReleaseId,
            })
          )
        );
        const result = yield* Effect.promise(() =>
          read(owned, {
            ...seed.request,
            selectors: seed.request.selectors.map((selector) => ({
              ...selector,
              snapshotReleaseId,
            })),
          })
        );
        assert.isNotNull(result);
        assert.strictEqual(result.bundleJson, seed.runtime.bundleJson);
        assert.notStrictEqual(snapshotReleaseId, seed.runtime.sourceReleaseId);
      })
  );
  it.effect("requires a signed-in reader who owns the attempt", () =>
    Effect.gen(function* () {
      const { owned, seed, t } = yield* Effect.promise(() => setup());
      assert.isNull(yield* Effect.promise(() => read(t, seed.request)));
      const stranger = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          seedAuthenticatedUser(ctx, {
            now: TRYOUT_TEST_NOW,
            suffix: "history-stranger",
          })
        )
      );
      assert.isNull(
        yield* Effect.promise(() =>
          read(
            t.withIdentity({
              subject: stranger.authUserId,
              sessionId: stranger.sessionId,
            }),
            seed.request
          )
        )
      );
      assert.isNotNull(yield* Effect.promise(() => read(owned, seed.request)));
    })
  );
  it.effect(
    "reads active questions while withholding answers and unstarted sections",
    () =>
      Effect.gen(function* () {
        const { owned, seed, t } = yield* Effect.promise(() => setup());
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            await ctx.db.patch(seed.request.attemptId, {
              status: "in-progress",
            });
            await ctx.db.patch(seed.sectionId, {
              status: "in-progress",
            });
          })
        );
        assert.isNull(yield* Effect.promise(() => read(owned, seed.request)));
        assert.isNotNull(
          yield* Effect.promise(() =>
            read(owned, {
              ...seed.request,
              selectors: seed.request.selectors.slice(0, 1),
            })
          )
        );
        assert.isNull(
          yield* Effect.promise(() =>
            read(owned, {
              ...seed.request,
              selectors: seed.request.selectors.map((selector) => ({
                ...selector,
                sectionKey: "not-started",
              })),
            })
          )
        );
      })
  );
  it.effect(
    "rejects another placement even when its artifact remains signed",
    () =>
      Effect.gen(function* () {
        const { owned, seed } = yield* Effect.promise(() => setup());
        assert.isNull(
          yield* Effect.promise(() =>
            read(owned, {
              ...seed.request,
              selectors: seed.request.selectors.map((selector) => ({
                ...selector,
                artifactHash: seed.fixture.answer.artifactHash,
                contentKey: seed.fixture.answer.contentKey,
                delivery: "authenticated",
              })),
            })
          )
        );
        assert.isNull(
          yield* Effect.promise(() =>
            read(owned, {
              ...seed.request,
              selectors: seed.request.selectors.map((selector) => ({
                ...selector,
                questionOrder: 2,
              })),
            })
          )
        );
        assert.isNull(
          yield* Effect.promise(() =>
            read(owned, {
              ...seed.request,
              selectors: seed.request.selectors.map((selector) => ({
                ...selector,
                snapshotId: "another-snapshot",
              })),
            })
          )
        );
      })
  );
  it.effect(
    "rejects damaged frozen snapshot membership with a typed error",
    () =>
      Effect.gen(function* () {
        const { owned, seed, t } = yield* Effect.promise(() => setup(true));
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            ctx.db.patch(seed.retainedId, {
              rowHash: "changed",
            })
          )
        );
        const error = yield* Effect.promise(() =>
          readFailure(owned, seed.request)
        );
        assert.deepStrictEqual(error, {
          code: "TRYOUT_HISTORY_INTEGRITY",
          message: "Try-out placement lost its original snapshot membership.",
        });
      })
  );
  it.effect(
    "bounds selector count and complete request bytes before database selection",
    () =>
      Effect.gen(function* () {
        const { owned, seed } = yield* Effect.promise(() => setup());
        const question = seed.request.selectors[0];
        assert.isDefined(question);
        for (const selectors of [
          [],
          Array.from(
            {
              length: MAX_PROTECTED_RUNTIME_SELECTORS + 1,
            },
            () => question
          ),
          [
            {
              ...question,
              sourcePath: "x".repeat(MAX_PROTECTED_RUNTIME_REQUEST_BYTES),
            },
          ],
        ]) {
          const error = yield* Effect.promise(() =>
            readFailure(owned, {
              ...seed.request,
              selectors,
            })
          );
          assert.strictEqual(error.code, "TRYOUT_HISTORY_REQUEST_INVALID");
        }
      })
  );
  it.effect("rejects a permanent bundle with changed stored provenance", () =>
    Effect.gen(function* () {
      const { owned, seed, t } = yield* Effect.promise(() => setup());
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          ctx.db.patch(seed.runtime._id, {
            sourceGitSha: "changed-source",
          })
        )
      );
      assert.strictEqual(
        (yield* Effect.promise(() => readFailure(owned, seed.request))).code,
        "TRYOUT_HISTORY_INTEGRITY"
      );
    })
  );
  it.effect(
    "stops a valid signed batch before exceeding its response byte ceiling",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const seed = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            insertHistoryAttempt(ctx, false, {
              rawMdx: "technical ".repeat(8000),
            })
          )
        );
        const owned = t.withIdentity({
          subject: seed.identity.authUserId,
          sessionId: seed.identity.sessionId,
        });
        const question = seed.request.selectors[0];
        assert.isDefined(question);
        const selectors = Array.from(
          {
            length: MAX_PROTECTED_RUNTIME_SELECTORS,
          },
          () => question
        );
        assert.strictEqual(
          (yield* Effect.promise(() =>
            readFailure(owned, {
              ...seed.request,
              selectors,
            })
          )).code,
          "TRYOUT_HISTORY_RESPONSE_TOO_LARGE"
        );
      })
  );
});
