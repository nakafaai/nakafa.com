import { assert, beforeEach, describe, it } from "@effect/vitest";
import {
  MAX_PROTECTED_RUNTIME_REQUEST_BYTES,
  MAX_PROTECTED_RUNTIME_SELECTORS,
} from "@nakafa/aksara-contracts/runtime/protected/limits";
import { decodeCurrentSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import type { TryoutBodyBatch } from "@repo/backend/convex/tryouts/runtime/body";
import { readTryoutHistory } from "@repo/backend/convex/tryouts/runtime/history/read";
import type { TryoutHistoryRequest } from "@repo/backend/convex/tryouts/runtime/history/spec";
import { insertHistoryAttempt } from "@repo/backend/test/tryout/history";
import { TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";
import { makeFunctionReference } from "convex/server";
import { Effect } from "effect";

type Harness = Pick<ReturnType<typeof createConvexTestWithBetterAuth>, "query">;
const readReference = makeFunctionReference<
  "query",
  TryoutHistoryRequest,
  TryoutBodyBatch | null
>("tryouts/queries/content:getBatch");

function read(t: Harness, request: TryoutHistoryRequest) {
  return t.query(readReference, request);
}

function readFailure(t: Harness, request: TryoutHistoryRequest) {
  return t.query((ctx) =>
    runConvexProgram(
      readTryoutHistory(ctx, request).pipe(
        Effect.match({
          onFailure: ({ code, message }) => ({ code, message }),
          onSuccess: () => ({
            code: "UNEXPECTED_SUCCESS",
            message: "Expected a typed failure.",
          }),
        })
      )
    )
  );
}

async function setup(historical = false) {
  const t = createConvexTestWithBetterAuth();
  const seed = await t.mutation((ctx) => insertHistoryAttempt(ctx, historical));
  const owned = t.withIdentity({
    subject: seed.identity.authUserId,
    sessionId: seed.identity.sessionId,
  });
  return { owned, seed, t };
}

beforeEach(() => vi.setSystemTime(new Date(TRYOUT_TEST_NOW)));

describe("tryouts/runtime/history/read", () => {
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
      const stored = yield* Effect.promise(() =>
        t.query((ctx) =>
          ctx.db
            .query("contentArtifacts")
            .withIndex("by_artifactHash", (index) =>
              index.eq("artifactHash", seed.fixture.question.artifactHash)
            )
            .unique()
        )
      );
      assert.isNotNull(stored);
      assert.strictEqual(result.items[0]?.artifactJson, stored.artifactJson);
    })
  );

  it.effect("requires the current session and exact attempt owner", () =>
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
      vi.setSystemTime(new Date(TRYOUT_TEST_NOW + 366 * 24 * 60 * 60 * 1000));
      assert.isNull(yield* Effect.promise(() => read(owned, seed.request)));
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
            await ctx.db.patch(seed.sectionId, { status: "in-progress" });
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
            ctx.db.patch(seed.retainedId, { rowHash: "changed" })
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
            { length: MAX_PROTECTED_RUNTIME_SELECTORS + 1 },
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
            readFailure(owned, { ...seed.request, selectors })
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
          ctx.db.patch(seed.runtime._id, { sourceGitSha: "changed-source" })
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
            insertHistoryAttempt(ctx, false, "technical ".repeat(8000))
          )
        );
        const owned = t.withIdentity({
          subject: seed.identity.authUserId,
          sessionId: seed.identity.sessionId,
        });
        const question = seed.request.selectors[0];
        assert.isDefined(question);
        const selectors = Array.from(
          { length: MAX_PROTECTED_RUNTIME_SELECTORS },
          () => question
        );
        assert.strictEqual(
          (yield* Effect.promise(() =>
            readFailure(owned, { ...seed.request, selectors })
          )).code,
          "TRYOUT_HISTORY_RESPONSE_TOO_LARGE"
        );
      })
  );
});
