import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import tryoutAttemptPlacementsTable from "@repo/backend/confect/_generated/tables/tryoutAttemptPlacements";
import { Grade } from "@repo/backend/confect/assessment/grade";
import { gradeAnswer } from "@repo/backend/confect/tryouts/response/answer";
import { responseIntegrity } from "@repo/backend/confect/tryouts/response/spec";
import { readPlacedQuestion } from "@repo/backend/confect/tryouts/runtime/question";
import type { TryoutSection } from "@repo/backend/confect/tryouts/runtime/schema";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  Array as Arr,
  Effect,
  HashMap,
  MutableHashMap,
  MutableHashSet,
  Option,
  Result,
  Schema,
} from "effect";

type TryoutPlacement = Docs["tryoutAttemptPlacements"];
type TryoutResponse = Docs["tryoutResponses"];
type TryoutAttempt = Docs["tryoutAttempts"];
type TryoutSectionAttempt = Docs["tryoutSectionAttempts"];
const ResponsePlacementLinkSchema = Schema.Struct({
  placement: tryoutAttemptPlacementsTable.Doc,
  sectionAttemptId: IdSchema("tryoutSectionAttempts"),
});
type ResponsePlacementLink = typeof ResponsePlacementLinkSchema.Type;

/** Indexes an attempt's frozen sections by key, failing when one holds no questions or a key or order repeats. */
export const validateTryoutSections = Effect.fn(
  "tryouts.response.validateSections"
)(function* (sections: readonly TryoutSection[]) {
  const sectionsByKey = MutableHashMap.empty<string, TryoutSection>();
  const sectionOrders = MutableHashSet.empty<number>();
  for (const section of sections) {
    if (
      !Number.isSafeInteger(section.questionCount) ||
      section.questionCount < 1
    ) {
      return yield* responseIntegrity(
        "TRYOUT_PLACEMENT_COUNT_MISMATCH",
        "Try-out sections must contain a positive whole number of questions."
      );
    }
    if (
      MutableHashMap.has(sectionsByKey, section.sectionKey) ||
      MutableHashSet.has(sectionOrders, section.sectionOrder)
    ) {
      return yield* responseIntegrity(
        "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH",
        "Try-out sections contain a duplicate key or order."
      );
    }
    MutableHashMap.set(sectionsByKey, section.sectionKey, section);
    MutableHashSet.add(sectionOrders, section.sectionOrder);
  }
  return sectionsByKey;
});

/** Resolves the frozen section a running section attempt belongs to, and checks the two agree. */
export const requireTryoutResponseSection = Effect.fn(
  "tryouts.response.requireSection"
)(function* (attempt: TryoutAttempt, sectionAttempt: TryoutSectionAttempt) {
  const sectionsByKey = yield* validateTryoutSections(attempt.sections);
  const section = Option.getOrUndefined(
    MutableHashMap.get(sectionsByKey, sectionAttempt.sectionKey)
  );
  if (
    !section ||
    sectionAttempt.tryoutAttemptId !== attempt._id ||
    sectionAttempt.sectionOrder !== section.sectionOrder ||
    sectionAttempt.totalQuestions !== section.questionCount
  ) {
    return yield* responseIntegrity(
      "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH",
      "Try-out section attempt differs from its frozen section."
    );
  }
  return section;
});

/**
 * Validates an attempt's complete placement inventory against its frozen sections: one place for
 * each question of each section, numbered from 1 within its section, and each item family once, as
 * an item takes one place in a paper.
 */
export const validateTryoutResponsePlacementInventory = Effect.fn(
  "tryouts.response.validatePlacementInventory"
)(function* (input: {
  readonly attemptId: Id<"tryoutAttempts">;
  readonly expectedQuestionCount: number;
  readonly placements: readonly TryoutPlacement[];
  readonly sections: readonly TryoutSection[];
}) {
  if (
    !Number.isSafeInteger(input.expectedQuestionCount) ||
    input.expectedQuestionCount < 1
  ) {
    return yield* responseIntegrity(
      "TRYOUT_PLACEMENT_COUNT_MISMATCH",
      "Try-out attempts must contain a positive whole number of questions."
    );
  }
  const sectionsByKey = yield* validateTryoutSections(input.sections);
  const sectionQuestionCount = Arr.reduce(
    input.sections,
    0,
    (total, section) => total + section.questionCount
  );
  if (
    sectionQuestionCount !== input.expectedQuestionCount ||
    input.placements.length !== input.expectedQuestionCount
  ) {
    return yield* responseIntegrity(
      "TRYOUT_PLACEMENT_COUNT_MISMATCH",
      "Try-out placement count does not match its frozen sections."
    );
  }
  const slots = MutableHashSet.empty<string>();
  const families = MutableHashSet.empty<string>();
  for (const placement of input.placements) {
    const section = Option.getOrUndefined(
      MutableHashMap.get(sectionsByKey, placement.sectionKey)
    );
    if (!section || placement.tryoutAttemptId !== input.attemptId) {
      return yield* responseIntegrity(
        "TRYOUT_RESPONSE_LINK_MISMATCH",
        "Try-out placement differs from its frozen sections."
      );
    }
    if (
      !Number.isSafeInteger(placement.questionOrder) ||
      placement.questionOrder < 1 ||
      placement.questionOrder > section.questionCount
    ) {
      return yield* responseIntegrity(
        "TRYOUT_PLACEMENT_COUNT_MISMATCH",
        "Try-out placement slots do not match its frozen section."
      );
    }
    const slot = `${placement.sectionKey} ${placement.questionOrder}`;
    if (
      MutableHashSet.has(slots, slot) ||
      MutableHashSet.has(families, placement.family)
    ) {
      return yield* responseIntegrity(
        "TRYOUT_PLACEMENT_DUPLICATE",
        "Try-out placement inventory contains a duplicate item or slot."
      );
    }
    MutableHashSet.add(slots, slot);
    MutableHashSet.add(families, placement.family);
  }
  return input.placements;
});

const sameGrade = Schema.toEquivalence(Grade);

/**
 * Validates response rows against their verified placements and keeps their stored order. Each
 * response links to its placement and section, answers its placement once, and keeps the grade its
 * placement's frozen rule gives it now; a grade that waits for a person defers to the stored one,
 * which a person may already have decided.
 */
export const indexTryoutResponses = Effect.fn(
  "tryouts.response.indexIntegrity"
)(function* (input: {
  readonly attemptId: Id<"tryoutAttempts">;
  readonly links: readonly ResponsePlacementLink[];
  readonly responses: readonly TryoutResponse[];
}) {
  const linksByPlacement = HashMap.fromIterable(
    Arr.map(input.links, (link) => [link.placement._id, link])
  );
  const placementIds = MutableHashSet.empty<Id<"tryoutAttemptPlacements">>();
  for (const response of input.responses) {
    const link = Option.getOrUndefined(
      HashMap.get(linksByPlacement, response.placementId)
    );
    if (
      !link ||
      response.tryoutAttemptId !== input.attemptId ||
      response.tryoutSectionAttemptId !== link.sectionAttemptId
    ) {
      return yield* responseIntegrity(
        "TRYOUT_RESPONSE_LINK_MISMATCH",
        "Try-out response links do not match its frozen attempt placement."
      );
    }
    if (MutableHashSet.has(placementIds, response.placementId)) {
      return yield* responseIntegrity(
        "TRYOUT_RESPONSE_PLACEMENT_DUPLICATE",
        "Try-out placement has more than one response."
      );
    }
    const regraded = gradeAnswer(
      yield* readPlacedQuestion(link.placement),
      response.response
    );
    if (
      Result.isFailure(regraded) ||
      !(
        regraded.success.grade.status === "pending" ||
        sameGrade(regraded.success.grade, response.grade)
      )
    ) {
      return yield* responseIntegrity(
        "TRYOUT_RESPONSE_GRADE_MISMATCH",
        "Try-out response differs from the grade of its frozen question."
      );
    }
    MutableHashSet.add(placementIds, response.placementId);
  }
  return input.responses;
});
