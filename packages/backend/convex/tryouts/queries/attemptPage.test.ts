import { describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import {
  activateRenamedTryoutStartSource,
  activateReusedTryoutStartPath,
  activateRevisedTryoutStartEntry,
  TRYOUT_RENAMED_SET_PATH,
  TRYOUT_REUSED_SECTION,
  TRYOUT_REUSED_SET,
  TRYOUT_REVISED_SECTION,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_NOW,
  TRYOUT_START_SECTION,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout/source";
import { seedTryoutStartSet } from "@repo/backend/test/tryout/start";
import type { FunctionArgs, WithoutSystemFields } from "convex/server";
import { Effect } from "effect";

type AttemptPatch = Partial<WithoutSystemFields<Doc<"tryoutAttempts">>>;
type ProgressPatch = Partial<WithoutSystemFields<Doc<"tryoutSetProgress">>>;
type SectionSnapshot = Doc<"tryoutAttempts">["sectionSnapshots"][number];
type AttemptPage = typeof api.tryouts.queries.attemptPage;
type SetRequest = FunctionArgs<AttemptPage["getSet"]>["request"];
type SectionRequest = FunctionArgs<AttemptPage["getSection"]>["request"];

const setIdentity = {
  countryKey: TRYOUT_START_COUNTRY,
  examKey: TRYOUT_START_EXAM,
  locale: "id" as const,
  setKey: TRYOUT_START_SET,
  trackKey: TRYOUT_START_TRACK,
};
const setPublicPath = `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}/${TRYOUT_START_SET}`;
const sectionPublicPath = `${setPublicPath}/${TRYOUT_START_SECTION}`;
const retainedRequest = (
  attemptId: Id<"tryoutAttempts">,
  publicPath: string
) => ({
  attemptId,
  kind: "retained" as const,
  locale: "id" as const,
  publicPath,
});
const useTryoutTime = Effect.sync(() =>
  vi.setSystemTime(new Date(TRYOUT_START_NOW))
);

const invoke = <A>(operation: () => PromiseLike<A>) =>
  Effect.promise(operation);

const seedClient = Effect.fn("tryouts.queries.attemptPage.test.seedClient")(
  function* (suffix: string, visibility: "internal-entry" | "visible") {
    const t = createConvexTestWithBetterAuth();
    const identity = yield* invoke(() =>
      t.mutation(async (ctx) => {
        const user = await seedAuthenticatedUser(ctx, {
          now: TRYOUT_START_NOW,
          suffix,
        });
        await seedTryoutStartSet(ctx, { userId: user.userId, visibility });
        return user;
      })
    );
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const querySection = (request: SectionRequest) =>
      authed.query(api.tryouts.queries.attemptPage.getSection, { request });
    const querySet = (request: SetRequest) =>
      authed.query(api.tryouts.queries.attemptPage.getSet, { request });
    return {
      complete: (attemptId: Id<"tryoutAttempts">) =>
        invoke(() =>
          authed.mutation(api.tryouts.mutations.sections.complete, {
            attemptId,
            sectionKey: TRYOUT_START_SECTION,
          })
        ),
      expectSectionRejected: (request: SectionRequest, expected: string) =>
        expectRejected(() => querySection(request), expected),
      expectSetRejected: (request: SetRequest, expected: string) =>
        expectRejected(() => querySet(request), expected),
      identity,
      patchSnapshots: (
        attemptId: Id<"tryoutAttempts">,
        patch: Partial<SectionSnapshot>
      ) =>
        invoke(() =>
          t.mutation(async (ctx) => {
            const attempt = await ctx.db.get(attemptId);
            const original = attempt?.sectionSnapshots.at(0);
            if (!(attempt && original)) {
              throw new Error("Expected one frozen section snapshot.");
            }
            await ctx.db.patch(attemptId, {
              sectionSnapshots: attempt.sectionSnapshots.map((snapshot) => ({
                ...snapshot,
                ...patch,
              })),
            });
            return original;
          })
        ),
      readSection: (request: SectionRequest) =>
        invoke(() => querySection(request)),
      readSet: (request: SetRequest) => invoke(() => querySet(request)),
      startAtDestination: () =>
        invoke(() =>
          authed.mutation(api.tryouts.mutations.attempts.startAttempt, {
            ...setIdentity,
            destinationSectionKey: TRYOUT_START_SECTION,
          })
        ),
      startAtEntry: () =>
        invoke(() =>
          authed.mutation(api.tryouts.mutations.attempts.startAttempt, {
            ...setIdentity,
            entrySectionKey: TRYOUT_START_SECTION,
          })
        ),
      startSection: (attemptId: Id<"tryoutAttempts">) =>
        invoke(() =>
          authed.mutation(api.tryouts.mutations.sections.start, {
            attemptId,
            sectionKey: TRYOUT_START_SECTION,
          })
        ),
      t,
    };
  }
);

const expectRejected = Effect.fn(
  "tryouts.queries.attemptPage.test.expectRejected"
)(function* (operation: () => PromiseLike<unknown>, expected: string) {
  const failure = yield* Effect.tryPromise(operation).pipe(Effect.flip);
  expect(failure.cause).toEqual(
    expect.objectContaining({ message: expect.stringContaining(expected) })
  );
});

describe("tryouts/queries/attemptPage", () => {
  it.effect(
    "redirects an active set and resolves a current terminal restart",
    () =>
      Effect.gen(function* () {
        yield* useTryoutTime;
        const { complete, readSet, startAtEntry, t } = yield* seedClient(
          "set-attempt-page",
          "internal-entry"
        );
        const started = yield* startAtEntry();

        const currentRequest = { kind: "current" as const, ...setIdentity };
        expect(yield* readSet(currentRequest)).toEqual({
          attemptId: started.attemptId,
          kind: "redirect",
          publicPath: setPublicPath,
        });

        const request = retainedRequest(started.attemptId, setPublicPath);
        const active = yield* readSet(request);
        expect(active).toMatchObject({
          attemptId: started.attemptId,
          content: { answers: [], kind: "signed" },
          initialState: {
            attempt: { status: "in-progress" },
            runtime: { questions: expect.any(Array) },
          },
          kind: "retained",
          page: {
            entrySection: { sectionKey: TRYOUT_START_SECTION },
            set: { setKey: TRYOUT_START_SET },
          },
        });
        expect(active).not.toHaveProperty("setIdentity");

        const historicalAnswerTime = TRYOUT_START_NOW + 1000;
        const historicalOption = yield* invoke(() =>
          t.mutation(async (ctx) => {
            const placement = await ctx.db
              .query("tryoutAttemptPlacements")
              .withIndex("by_tryoutAttemptId_and_questionOrder", (query) =>
                query.eq("tryoutAttemptId", started.attemptId)
              )
              .unique();
            const section = await ctx.db
              .query("tryoutSectionAttempts")
              .withIndex("by_tryoutAttemptId_and_sectionKey", (query) =>
                query
                  .eq("tryoutAttemptId", started.attemptId)
                  .eq("sectionKey", TRYOUT_START_SECTION)
              )
              .unique();
            const selectedOption =
              placement?.responseSpec?.kind === "single-choice"
                ? placement.responseSpec.options.at(0)
                : undefined;
            if (!(placement && section && selectedOption)) {
              throw new Error("Expected one historical response target.");
            }
            await ctx.db.insert("tryoutResponses", {
              answeredAt: historicalAnswerTime,
              isComplete: true,
              isCorrect: selectedOption.isCorrect,
              placementId: placement._id,
              selection: {
                kind: "single-choice",
                optionKey: selectedOption.optionKey,
              },
              timeSpent: 1000,
              tryoutAttemptId: started.attemptId,
              tryoutSectionAttemptId: section._id,
              updatedAt: historicalAnswerTime,
            });
            return selectedOption;
          })
        );

        yield* complete(started.attemptId);
        yield* invoke(() => t.mutation(activateRevisedTryoutStartEntry));
        const terminal = yield* readSet(currentRequest);
        expect(terminal).toMatchObject({
          attemptId: started.attemptId,
          content: { kind: "signed" },
          initialState: {
            attempt: {
              score: { publishedScore: expect.any(Number) },
              status: "completed",
            },
            runtime: { section: { status: "completed" } },
          },
          kind: "current",
          page: { set: { publicPath: setPublicPath } },
          restartTarget: {
            entrySection: { sectionKey: TRYOUT_REVISED_SECTION },
            setPublicPath: TRYOUT_RENAMED_SET_PATH,
          },
        });
        expect(terminal).not.toHaveProperty("setIdentity");
        if (
          terminal?.kind !== "current" ||
          terminal.content.kind !== "signed"
        ) {
          return yield* Effect.die("Expected signed terminal set content.");
        }
        expect(
          terminal.initialState.runtime?.questions.at(0)?.response
        ).toEqual({
          answeredAt: historicalAnswerTime,
          isComplete: true,
          selection: {
            kind: "single-choice",
            optionKey: historicalOption.optionKey,
          },
          updatedAt: historicalAnswerTime,
        });
      })
  );

  it.effect("rejects progress that disagrees with its latest attempt", () =>
    Effect.gen(function* () {
      yield* useTryoutTime;
      const { expectSetRejected, identity, startAtEntry, t } =
        yield* seedClient("progress-owner", "internal-entry");
      const otherUserId = yield* invoke(() =>
        t.mutation((ctx) =>
          seedAuthenticatedUser(ctx, {
            now: TRYOUT_START_NOW,
            suffix: "progress-other",
          }).then(({ userId }) => userId)
        )
      );
      const started = yield* startAtEntry();
      const request = { kind: "current" as const, ...setIdentity };
      const expectMismatch = () =>
        expectSetRejected(request, "TRYOUT_PROGRESS_ATTEMPT_MISMATCH");
      const corrupt = Effect.fn(
        "tryouts.queries.attemptPage.test.corruptProgress"
      )(function* (operation: () => PromiseLike<unknown>) {
        yield* invoke(operation);
        yield* expectMismatch();
      });

      const progress = yield* invoke(() =>
        t.mutation(async (ctx) => {
          const progress = await ctx.db.query("tryoutSetProgress").unique();
          if (!progress) {
            throw new Error("Expected one try-out progress row.");
          }
          return { id: progress._id, setIdentity: progress.setIdentity };
        })
      );
      const patchAttempt = (values: AttemptPatch) => () =>
        t.mutation((ctx) => ctx.db.patch(started.attemptId, values));
      const patchProgress = (values: ProgressPatch) => () =>
        t.mutation((ctx) => ctx.db.patch(progress.id, values));

      yield* corrupt(patchProgress({ countryKey: "germany" }));
      yield* invoke(patchProgress({ countryKey: TRYOUT_START_COUNTRY }));

      yield* corrupt(patchAttempt({ countryKey: "germany" }));
      yield* corrupt(
        patchAttempt({
          countryKey: TRYOUT_START_COUNTRY,
          userId: otherUserId,
        })
      );
      yield* corrupt(
        patchAttempt({ setIdentity: "set:drift", userId: identity.userId })
      );
      yield* invoke(patchAttempt({ setIdentity: progress.setIdentity }));

      yield* corrupt(patchProgress({ attemptNumber: 2 }));
      yield* corrupt(patchProgress({ attemptNumber: 1, status: "completed" }));
      yield* corrupt(patchProgress({ status: "in-progress", statusRank: 2 }));
    })
  );

  it.effect(
    "keeps frozen review while resolving the current signed restart entry",
    () =>
      Effect.gen(function* () {
        yield* useTryoutTime;
        const { complete, readSet, startAtEntry, t } = yield* seedClient(
          "set-restart-target",
          "internal-entry"
        );
        const started = yield* startAtEntry();
        yield* complete(started.attemptId);
        const request = retainedRequest(started.attemptId, setPublicPath);

        yield* invoke(() => t.mutation(activateRevisedTryoutStartEntry));
        const revised = yield* readSet(request);
        expect(revised).toMatchObject({
          kind: "retained",
          page: {
            entrySection: { sectionKey: TRYOUT_START_SECTION },
            set: { publicPath: setPublicPath },
          },
          restartTarget: {
            entrySection: {
              sectionKey: TRYOUT_REVISED_SECTION,
              visibility: "internal-entry",
            },
            setPublicPath: TRYOUT_RENAMED_SET_PATH,
          },
        });
        if (revised?.kind !== "retained") {
          return yield* Effect.die("Expected one retained set page.");
        }
        expect(revised.page.entrySection?.publicPath).toBeUndefined();
        expect(revised.restartTarget?.entrySection.publicPath).toBeUndefined();

        yield* invoke(() => t.mutation(activateReusedTryoutStartPath));
        expect(yield* readSet(request)).toMatchObject({
          kind: "retained",
          page: {
            entrySection: { sectionKey: TRYOUT_START_SECTION },
            set: { publicPath: setPublicPath },
          },
          restartTarget: null,
        });
      })
  );

  it.effect(
    "keeps exact section ownership after rename and rejects reused paths",
    () =>
      Effect.gen(function* () {
        yield* useTryoutTime;
        const {
          expectSectionRejected,
          expectSetRejected,
          patchSnapshots,
          readSection,
          readSet,
          startAtDestination,
          startSection,
          t,
        } = yield* seedClient("section-attempt-page", "visible");
        const started = yield* startAtDestination();
        yield* startSection(started.attemptId);

        const currentRequest = {
          kind: "current" as const,
          sectionKey: TRYOUT_START_SECTION,
          ...setIdentity,
        };
        expect(yield* readSection(currentRequest)).toEqual({
          attemptId: started.attemptId,
          kind: "redirect",
          publicPath: sectionPublicPath,
        });

        const request = retainedRequest(started.attemptId, sectionPublicPath);
        const readRetainedSection = () => readSection(request);
        expect(yield* readRetainedSection()).toMatchObject({
          activeSectionPublicPath: sectionPublicPath,
          activeSetPublicPath: setPublicPath,
          content: { answers: [], kind: "signed" },
          initialState: {
            attempt: { attemptId: started.attemptId },
            runtime: { questions: expect.any(Array) },
          },
          kind: "retained",
          page: { section: { sectionKey: TRYOUT_START_SECTION } },
        });

        yield* invoke(() => t.mutation(activateRenamedTryoutStartSource));
        expect(yield* readRetainedSection()).toMatchObject({
          activeSectionPublicPath:
            expect.stringContaining(TRYOUT_START_SECTION),
          activeSetPublicPath: TRYOUT_RENAMED_SET_PATH,
          kind: "retained",
        });

        yield* invoke(() => t.mutation(activateRevisedTryoutStartEntry));
        expect(yield* readRetainedSection()).toMatchObject({
          activeSectionPublicPath: null,
          activeSetPublicPath: TRYOUT_RENAMED_SET_PATH,
          kind: "retained",
        });

        yield* invoke(() => t.mutation(activateReusedTryoutStartPath));
        expect(
          yield* readSection({
            countryKey: TRYOUT_START_COUNTRY,
            examKey: TRYOUT_START_EXAM,
            kind: "current",
            locale: "id",
            sectionKey: TRYOUT_REUSED_SECTION,
            setKey: TRYOUT_REUSED_SET,
            trackKey: TRYOUT_START_TRACK,
          })
        ).toBeNull();
        expect(yield* readRetainedSection()).toMatchObject({
          activeSectionPublicPath: null,
          activeSetPublicPath: null,
          kind: "retained",
        });
        expect(
          yield* invoke(() =>
            t.query(api.tryouts.queries.attemptPage.getSection, {
              request,
            })
          )
        ).toBeNull();
        expect(
          yield* readSet({
            attemptId: "not-an-id",
            kind: "retained",
            locale: "id",
            publicPath: setPublicPath,
          })
        ).toBeNull();

        const originalSnapshot = yield* patchSnapshots(started.attemptId, {
          sourceRevision: "source:drift",
        });
        yield* expectSectionRejected(
          request,
          "TRYOUT_SECTION_SNAPSHOT_MISMATCH"
        );

        yield* patchSnapshots(started.attemptId, {
          sectionRowHash: "hash:drift",
          sourceRevision: originalSnapshot.sourceRevision,
        });
        yield* expectSetRejected(
          retainedRequest(started.attemptId, setPublicPath),
          "TRYOUT_SECTION_SNAPSHOT_MISMATCH"
        );
      })
  );
});
