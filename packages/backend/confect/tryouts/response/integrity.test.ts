import { describe, expect, it } from "@effect/vitest";
import { DeliveryLanguageSchema } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import type { Outcome, Selection } from "@repo/backend/confect/response/model";
import {
  indexTryoutResponses,
  validateTryoutSectionSnapshots,
} from "@repo/backend/confect/tryouts/response/integrity";
import { tryoutSectionSnapshot } from "@repo/backend/test/tryout/runtime";
import { makeSignedTryoutSection } from "@repo/backend/test/tryout/section";
import { makeTryoutSection } from "@repo/backend/test/tryouts";
import { Array as Arr, Effect, Schema } from "effect";

const attemptId = Schema.decodeUnknownSync(Id("tryoutAttempts"))("attempt");
const placementId = Schema.decodeUnknownSync(Id("tryoutAttemptPlacements"))(
  "placement"
);
const sectionAttemptId = Schema.decodeUnknownSync(Id("tryoutSectionAttempts"))(
  "section"
);
const label = { de: "Teil", en: "Part", id: "Bagian" };
const level = (order: number, points: number) => ({
  label,
  levelKey: `level-${order}`,
  order,
  points,
});

function placement(
  responseSpec: Docs["tryoutAttemptPlacements"]["responseSpec"]
): Docs["tryoutAttemptPlacements"] {
  return {
    _creationTime: 0,
    _id: placementId,
    answerArtifactHash: "answer",
    answerContentKey: "question-1/answer",
    contentHash: "content",
    placementIdentity: "placement",
    placementRowHash: "row",
    questionArtifactHash: "question",
    questionContentKey: "question-1/question",
    questionOrder: 1,
    rendererDomain: "snbt-math",
    responseSpec,
    sectionIdentity: "section",
    sectionKey: "section",
    sourcePath: "question-1",
    sourceRevision: "2026",
    tryoutAttemptId: attemptId,
  };
}

function response(
  selection: Selection,
  outcome: Outcome,
  isComplete = true
): Docs["tryoutResponses"] {
  return {
    _creationTime: 0,
    _id: Schema.decodeUnknownSync(Id("tryoutResponses"))("response"),
    answeredAt: 0,
    isComplete,
    isCorrect: outcome.status === "correct",
    outcome,
    placementId,
    selection,
    timeSpent: 0,
    tryoutAttemptId: attemptId,
    tryoutSectionAttemptId: sectionAttemptId,
    updatedAt: 0,
  };
}

const capital = placement({
  key: {
    acceptedAnswers: ["Jakarta"],
    collapseWhitespace: true,
    ignoreCase: true,
    kind: "text",
  },
  kind: "short-answer",
  language: DeliveryLanguageSchema.make("id"),
});
const results = placement({
  criteria: Arr.map([1, 2], (order) => ({
    criterionKey: `criterion-${order}`,
    finalAnswer: {
      acceptsFractions: false,
      kind: "number" as const,
      value: `${order}`,
    },
    label,
    levels: [level(1, 0), level(2, 2)],
    order,
  })),
  kind: "rubric",
  language: DeliveryLanguageSchema.make("id"),
});
const halfRight: Selection = {
  finalAnswers: [
    { criterionKey: "criterion-1", text: "1" },
    { criterionKey: "criterion-2", text: "3" },
  ],
  kind: "rubric",
  text: "",
};

/** Indexes one stored response against its placement, or returns the failure code. */
function index(
  frozen: Docs["tryoutAttemptPlacements"],
  stored: Docs["tryoutResponses"]
) {
  return indexTryoutResponses({
    attemptId,
    links: [{ placement: frozen, sectionAttemptId }],
    responses: [stored],
  }).pipe(
    Effect.match({
      onFailure: (error) => error.code,
      onSuccess: (indexed) => indexed.size,
    })
  );
}

const firstSnapshot = tryoutSectionSnapshot({
  signed: makeSignedTryoutSection(
    makeTryoutSection({ sectionKey: "first-section" })
  ).signed,
});
const secondSnapshot = tryoutSectionSnapshot({
  signed: makeSignedTryoutSection(
    makeTryoutSection({ order: 2, sectionKey: "second-section" })
  ).signed,
});

describe("tryouts/response/integrity", () => {
  it.live.each([
    {
      kind: "identity",
      snapshot: {
        ...secondSnapshot,
        sectionIdentity: firstSnapshot.sectionIdentity,
      },
    },
    {
      kind: "key",
      snapshot: { ...secondSnapshot, sectionKey: firstSnapshot.sectionKey },
    },
    {
      kind: "order",
      snapshot: {
        ...secondSnapshot,
        sectionOrder: firstSnapshot.sectionOrder,
      },
    },
  ])("rejects duplicate snapshot $kind", ({ snapshot }) =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        validateTryoutSectionSnapshots([firstSnapshot, snapshot])
      );

      expect(error).toMatchObject({
        _tag: "TryoutResponseIntegrityError",
        code: "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH",
      });
    })
  );

  it.effect(
    "defers a pending evaluation to the stored decision of the grader",
    () =>
      Effect.gen(function* () {
        const unmatched: Selection = { kind: "short-answer", text: "Bandung" };

        expect(
          yield* index(capital, response(unmatched, { status: "pending" }))
        ).toBe(1);
        expect(
          yield* index(capital, response(unmatched, { status: "correct" }))
        ).toBe(1);
      })
  );

  it.effect("requires a stored partial outcome to earn the same points", () =>
    Effect.gen(function* () {
      expect(
        yield* index(
          results,
          response(halfRight, { points: 2, status: "partial" })
        )
      ).toBe(1);
      for (const outcome of [
        { points: 1, status: "partial" },
        { status: "correct" },
      ] satisfies Outcome[]) {
        expect(yield* index(results, response(halfRight, outcome))).toBe(
          "TRYOUT_RESPONSE_SELECTION_MISMATCH"
        );
      }
    })
  );
});
