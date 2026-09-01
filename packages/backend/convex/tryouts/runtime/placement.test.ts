import { describe, expect, it } from "@effect/vitest";
import { TRYOUT_ATTEMPT_PLACEMENT_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/tryout/limits";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { createAttemptPlacements } from "@repo/backend/convex/tryouts/runtime/placement";
import { TEST_RELEASE_ID } from "@repo/backend/test/content/release";
import {
  insertTryoutAttempt,
  insertTryoutUser,
  tryoutSectionSnapshot,
} from "@repo/backend/test/tryout/runtime";
import {
  makeSignedTryoutSection,
  makeSignedTryoutSource,
  TRYOUT_TEST_CONTENT_HASH,
} from "@repo/backend/test/tryout/section";
import { makeTryoutSection, makeTryoutSet } from "@repo/backend/test/tryouts";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const TRACK = "2027";
const SECTION = "penalaran-matematika";
const SOURCE = `question-bank/tryout/indonesia/snbt/${SECTION}/set-1`;
const SET_ROUTE = `try-out/indonesia/snbt/${TRACK}/set-1`;
const ROUTE = `${SET_ROUTE}/${SECTION}`;

/** Inserts one attempt backed entirely by a signed source fixture. */
const insertRuntime = Effect.fn("tryouts.runtime.placement.test.insertRuntime")(
  function* (ctx: Parameters<typeof insertTryoutUser>[0]) {
    const userId = yield* Effect.promise(() =>
      insertTryoutUser(ctx, {
        authId: "auth-placement",
        email: "placement@example.com",
        name: "Placement",
      })
    );
    const set = makeTryoutSet({ publicPath: SET_ROUTE });
    const section = makeTryoutSection({
      publicPath: ROUTE,
      questionSourcePath: `packages/corpus/${SOURCE}`,
    });
    const signedSection = makeSignedTryoutSection(section, {
      sourceRevision: "2027",
    });
    const source = makeSignedTryoutSource(set, [signedSection]);
    const attemptId = yield* Effect.promise(() =>
      insertTryoutAttempt(ctx, {
        sectionSnapshots: [tryoutSectionSnapshot(signedSection)],
        set,
        snapshotId: source.snapshot.snapshotId,
        snapshotReleaseId: TEST_RELEASE_ID,
        userId,
      })
    );
    const attempt = yield* Effect.promise(() => ctx.db.get(attemptId));

    if (!attempt) {
      return yield* Effect.die("Expected one signed attempt fixture.");
    }

    return { attempt, source };
  }
);

describe("tryouts/runtime/placement", () => {
  it.effect("freezes the exact signed placement facts", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);

      const placement = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const runtime = yield* insertRuntime(ctx);
              yield* createAttemptPlacements(ctx, runtime);
              return yield* Effect.promise(() =>
                ctx.db
                  .query("tryoutAttemptPlacements")
                  .withIndex(
                    "by_tryoutAttemptId_and_sectionKey_and_questionOrder",
                    (query) =>
                      query
                        .eq("tryoutAttemptId", runtime.attempt._id)
                        .eq("sectionKey", SECTION)
                  )
                  .unique()
              );
            })
          )
        )
      );

      expect(placement).toMatchObject({
        contentHash: TRYOUT_TEST_CONTENT_HASH,
        responseSpec: { kind: "single-choice" },
        sourceRevision: "2027",
      });
      expect(placement).not.toHaveProperty("questionId");
    })
  );

  it.effect("rejects an incomplete signed placement snapshot", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);

      const failure = yield* Effect.tryPromise(() =>
        t.mutation((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const runtime = yield* insertRuntime(ctx);
              const section = runtime.source.snapshot.sections[0];
              if (!section) {
                return yield* Effect.die(
                  "Expected one signed section fixture."
                );
              }

              yield* createAttemptPlacements(ctx, {
                attempt: runtime.attempt,
                source: {
                  ...runtime.source,
                  snapshot: {
                    ...runtime.source.snapshot,
                    sections: [{ ...section, placements: [] }],
                  },
                },
              });
            })
          )
        )
      ).pipe(Effect.flip);
      expect(failure.cause).toEqual(
        expect.objectContaining({
          message: expect.stringContaining("TRYOUT_SECTION_SNAPSHOT_MISMATCH"),
        })
      );
    })
  );

  it.effect(
    "rejects a canonical placement beyond the section read budget",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);

        const failure = yield* Effect.tryPromise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              Effect.gen(function* () {
                const runtime = yield* insertRuntime(ctx);
                const section = runtime.source.snapshot.sections[0];
                const placement = section?.placements[0];
                const response = placement?.row.response;
                const firstOption =
                  response?.kind === "single-choice"
                    ? response.options[0]
                    : undefined;
                const remainingOptions =
                  response?.kind === "single-choice"
                    ? response.options.slice(1)
                    : [];
                if (!(section && placement && response && firstOption)) {
                  return yield* Effect.die(
                    "Expected one signed placement fixture."
                  );
                }

                yield* createAttemptPlacements(ctx, {
                  attempt: runtime.attempt,
                  source: {
                    ...runtime.source,
                    snapshot: {
                      ...runtime.source.snapshot,
                      sections: [
                        {
                          ...section,
                          placements: [
                            {
                              ...placement,
                              row: {
                                ...placement.row,
                                response: {
                                  kind: "single-choice",
                                  options: [
                                    {
                                      ...firstOption,
                                      label: "x".repeat(
                                        TRYOUT_ATTEMPT_PLACEMENT_DOCUMENT_LIMIT
                                      ),
                                    },
                                    ...remainingOptions,
                                  ],
                                },
                              },
                            },
                          ],
                        },
                      ],
                    },
                  },
                });
              })
            )
          )
        ).pipe(Effect.flip);
        expect(failure.cause).toEqual(
          expect.objectContaining({
            message: expect.stringContaining("runtime read ceiling"),
          })
        );
      })
  );
});
