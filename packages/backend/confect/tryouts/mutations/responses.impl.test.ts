import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  type ConvexTest,
  expectConvexFailure,
  type ResponseFixture,
  readResponseState,
  seedResponseFixture,
  setResponseClock,
} from "@repo/backend/test/tryout/response";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import { TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";
import { Effect, Option } from "effect";

const saveAnswer = Effect.fn("test.tryout.response.saveAnswer")(
  (fixture: ResponseFixture, selection: Doc<"tryoutResponses">["selection"]) =>
    Effect.promise(() =>
      fixture.client.mutation(api.tryouts.mutations.responses.save, {
        placementId: fixture.placementId,
        selection,
      })
    )
);
const freezeSpec = Effect.fn("test.tryout.response.freezeSpec")(
  (
    t: ConvexTest,
    fixture: ResponseFixture,
    responseSpec: Doc<"tryoutAttemptPlacements">["responseSpec"]
  ) =>
    Effect.promise(() =>
      t.mutation((ctx) => ctx.db.patch(fixture.placementId, { responseSpec }))
    )
);

it.each([
  {
    scenario: "selection",
    tag: "TryoutResponseSelectionError",
    code: "TRYOUT_RESPONSE_SELECTION_INVALID",
  },
  {
    scenario: "integrity",
    tag: "TryoutResponseIntegrityError",
    code: "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH",
  },
  {
    scenario: "ownership",
    tag: "TryoutAttemptStateError",
    code: "TRYOUT_ATTEMPT_NOT_FOUND",
  },
  {
    scenario: "terminal",
    tag: "TryoutAttemptStateError",
    code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
  },
  {
    scenario: "auth",
    tag: "SessionRequired",
    code: "UNAUTHENTICATED",
  },
])(
  "restores the $scenario failure tag from the registered response payload",
  async ({ scenario, tag, code }) => {
    vi.setSystemTime(new Date(TRYOUT_TEST_NOW));
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation((ctx) =>
      seedTryoutContentAccessState(ctx, {
        suffix: scenario,
        attemptStatus: scenario === "terminal" ? "completed" : "in-progress",
        sectionStatus: "in-progress",
      })
    );
    if (scenario === "ownership") {
      await t.mutation((ctx) =>
        ctx.db.delete("tryoutAttempts", fixture.attemptId)
      );
    }
    if (scenario === "integrity") {
      await t.mutation((ctx) =>
        ctx.db.patch("tryoutSectionAttempts", fixture.sectionAttemptId, {
          sectionIdentity: "another-section",
        })
      );
    }
    const client =
      scenario === "auth"
        ? t
        : t.withIdentity({
            sessionId: fixture.identity.sessionId,
            subject: fixture.identity.authUserId,
          });
    const rejected = await client
      .mutation(api.tryouts.mutations.responses.save, {
        placementId: fixture.placementId,
        selection: {
          kind: "single-choice",
          optionKey: "outside-the-frozen-options",
        },
      })
      .catch((error: unknown) => error);
    expect(rejected).toMatchObject({
      data: {
        code,
      },
    });
    if (!Ref.isConvexError(rejected)) {
      throw rejected;
    }
    const decoded = Ref.decodeErrorOption(
      refs.public.tryouts.mutations.responses.save,
      rejected.data
    );
    expect(
      Option.map(decoded, (error) => ({
        _tag: error._tag,
        code: error.code,
      }))
    ).toEqual(
      Option.some({
        _tag: tag,
        code,
      })
    );
    expect(
      await t.query((ctx) => ctx.db.query("tryoutResponses").collect())
    ).toEqual([]);
  }
);

describe("tryouts/mutations/responses outcomes", () => {
  it.effect(
    "reads a response stored before outcomes from its correctness flag",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const seeded = yield* seedResponseFixture(t, "legacy-response");
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            await ctx.db.insert("tryoutResponses", {
              answeredAt: TRYOUT_TEST_NOW,
              isComplete: true,
              isCorrect: true,
              placementId: seeded.placementId,
              selection: { kind: "single-choice", optionKey: "option-1" },
              timeSpent: 0,
              tryoutAttemptId: seeded.attemptId,
              tryoutSectionAttemptId: seeded.sectionAttemptId,
              updatedAt: TRYOUT_TEST_NOW,
            });
            await ctx.db.patch(seeded.sectionAttemptId, {
              answeredCount: 1,
              correctAnswers: 1,
            });
          })
        );
        yield* setResponseClock(5000);
        yield* saveAnswer(seeded, {
          kind: "single-choice",
          optionKey: "option-2",
        });
        const stored = yield* readResponseState(t, seeded);
        expect(stored.responses[0]).toMatchObject({
          isCorrect: false,
          outcome: { status: "incorrect" },
        });
        expect(stored.section).toMatchObject({
          answeredCount: 1,
          correctAnswers: 0,
        });
      })
  );
  it.effect(
    "counts an unmatched text answer as answered while it awaits the grader",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const seeded = yield* seedResponseFixture(t, "pending-response");
        yield* freezeSpec(t, seeded, {
          key: {
            acceptedAnswers: ["Jakarta"],
            collapseWhitespace: true,
            ignoreCase: true,
            kind: "text",
          },
          kind: "short-answer",
          language: "id",
        });
        yield* setResponseClock(5000);
        yield* saveAnswer(seeded, { kind: "short-answer", text: "Bandung" });
        const pending = yield* readResponseState(t, seeded);
        expect(pending.responses[0]).toMatchObject({
          isComplete: true,
          isCorrect: false,
          outcome: { status: "pending" },
          selection: { kind: "short-answer", text: "Bandung" },
        });
        expect(pending.section).toMatchObject({
          answeredCount: 1,
          correctAnswers: 0,
        });
        yield* saveAnswer(seeded, { kind: "short-answer", text: " jakarta" });
        const matched = yield* readResponseState(t, seeded);
        expect(matched.responses[0]?.outcome).toEqual({ status: "correct" });
        expect(matched.section).toMatchObject({
          answeredCount: 1,
          correctAnswers: 1,
        });
      })
  );
  it.effect(
    "stores the exact number a typed answer was read as in its delivery language",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const seeded = yield* seedResponseFixture(t, "number-response");
        yield* freezeSpec(t, seeded, {
          key: { acceptsFractions: false, kind: "number", value: "0.5" },
          kind: "short-answer",
          language: "id",
        });
        yield* setResponseClock(5000);
        yield* saveAnswer(seeded, {
          kind: "short-answer",
          number: "9",
          text: "0,50",
        });
        const stored = yield* readResponseState(t, seeded);
        expect(stored.responses[0]).toMatchObject({
          isCorrect: true,
          outcome: { status: "correct" },
          selection: { kind: "short-answer", number: "0.5", text: "0,50" },
        });
        yield* expectConvexFailure(
          () =>
            seeded.client.mutation(api.tryouts.mutations.responses.save, {
              placementId: seeded.placementId,
              selection: { kind: "single-choice", optionKey: "option-1" },
            }),
          { code: "TRYOUT_RESPONSE_KIND_MISMATCH" }
        );
      })
  );
});
