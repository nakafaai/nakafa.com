import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { ConvexTaggedError } from "@repo/backend/convex/lib/effect";
import { Effect, Schema } from "effect";

type TryoutPlacement = Doc<"tryoutAttemptPlacements">;
type TryoutResponse = Doc<"tryoutResponses">;
type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutSectionAttempt = Doc<"tryoutSectionAttempts">;
type TryoutSectionSnapshot = TryoutAttempt["sectionSnapshots"][number];

interface ResponsePlacementLink {
  readonly placement: TryoutPlacement;
  readonly sectionAttemptId: Id<"tryoutSectionAttempts">;
}

/** Stable corruption detected across response, placement, and attempt rows. */
export class TryoutResponseIntegrityError
  extends Schema.TaggedError<TryoutResponseIntegrityError>()(
    "TryoutResponseIntegrityError",
    {
      code: Schema.Literal(
        "TRYOUT_PLACEMENT_COUNT_MISMATCH",
        "TRYOUT_PLACEMENT_DUPLICATE",
        "TRYOUT_RESPONSE_CHOICE_MISMATCH",
        "TRYOUT_RESPONSE_COUNT_EXCEEDED",
        "TRYOUT_RESPONSE_LINK_MISMATCH",
        "TRYOUT_RESPONSE_PLACEMENT_DUPLICATE",
        "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH"
      ),
      message: Schema.String,
    }
  )
  implements ConvexTaggedError
{
  declare readonly code:
    | "TRYOUT_PLACEMENT_COUNT_MISMATCH"
    | "TRYOUT_PLACEMENT_DUPLICATE"
    | "TRYOUT_RESPONSE_CHOICE_MISMATCH"
    | "TRYOUT_RESPONSE_COUNT_EXCEEDED"
    | "TRYOUT_RESPONSE_LINK_MISMATCH"
    | "TRYOUT_RESPONSE_PLACEMENT_DUPLICATE"
    | "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH";
  declare readonly message: string;
}

/** Resolves and validates the frozen section owned by one response graph. */
export const requireTryoutResponseSectionSnapshot = Effect.fn(
  "tryouts.response.requireSectionSnapshot"
)(function* (attempt: TryoutAttempt, section: TryoutSectionAttempt) {
  const snapshot = attempt.sectionSnapshots.find(
    (candidate) => candidate.sectionIdentity === section.sectionIdentity
  );
  if (
    !snapshot ||
    section.tryoutAttemptId !== attempt._id ||
    section.sectionKey !== snapshot.sectionKey ||
    section.sectionOrder !== snapshot.sectionOrder ||
    section.totalQuestions !== snapshot.questionCount
  ) {
    return yield* responseIntegrity(
      "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH",
      "Try-out section attempt differs from its frozen snapshot."
    );
  }

  return snapshot;
});

/** Validates placements against one exact attempt-owned section snapshot. */
export const validateTryoutResponsePlacements = Effect.fn(
  "tryouts.response.validatePlacements"
)(function* (
  attemptId: Id<"tryoutAttempts">,
  snapshot: TryoutSectionSnapshot,
  placements: readonly TryoutPlacement[]
) {
  if (
    placements.some(
      (placement) =>
        placement.tryoutAttemptId !== attemptId ||
        placement.sectionIdentity !== snapshot.sectionIdentity ||
        placement.sectionKey !== snapshot.sectionKey
    )
  ) {
    return yield* responseIntegrity(
      "TRYOUT_RESPONSE_LINK_MISMATCH",
      "Try-out placement differs from its frozen section snapshot."
    );
  }
});

/** Validates one complete placement inventory against frozen section slots. */
export const validateTryoutResponsePlacementInventory = Effect.fn(
  "tryouts.response.validatePlacementInventory"
)(function* (input: {
  readonly attemptId: Id<"tryoutAttempts">;
  readonly expectedQuestionCount: number;
  readonly placements: TryoutPlacement[];
  readonly snapshots: readonly TryoutSectionSnapshot[];
}) {
  const snapshotQuestionCount = input.snapshots.reduce(
    (total, snapshot) => total + snapshot.questionCount,
    0
  );
  if (
    snapshotQuestionCount !== input.expectedQuestionCount ||
    input.placements.length !== input.expectedQuestionCount
  ) {
    return yield* responseIntegrity(
      "TRYOUT_PLACEMENT_COUNT_MISMATCH",
      "Try-out placement count does not match its frozen snapshot."
    );
  }

  const snapshotsByIdentity = new Map<string, TryoutSectionSnapshot>();
  const questionOrdersBySection = new Map<string, Set<number>>();
  for (const snapshot of input.snapshots) {
    if (snapshotsByIdentity.has(snapshot.sectionIdentity)) {
      return yield* responseIntegrity(
        "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH",
        "Try-out section snapshots contain a duplicate identity."
      );
    }
    snapshotsByIdentity.set(snapshot.sectionIdentity, snapshot);
    questionOrdersBySection.set(snapshot.sectionIdentity, new Set());
  }

  const placementIdentities = new Set<string>();
  for (const placement of input.placements) {
    const snapshot = snapshotsByIdentity.get(placement.sectionIdentity);
    if (
      !snapshot ||
      placement.tryoutAttemptId !== input.attemptId ||
      placement.sectionKey !== snapshot.sectionKey
    ) {
      return yield* responseIntegrity(
        "TRYOUT_RESPONSE_LINK_MISMATCH",
        "Try-out placement differs from its frozen section snapshot."
      );
    }

    const questionOrder = placement.questionOrder;
    if (
      !Number.isSafeInteger(questionOrder) ||
      questionOrder < 1 ||
      questionOrder > snapshot.questionCount
    ) {
      return yield* responseIntegrity(
        "TRYOUT_PLACEMENT_COUNT_MISMATCH",
        "Try-out placement slots do not match its frozen section snapshot."
      );
    }

    const questionOrders = questionOrdersBySection.get(
      placement.sectionIdentity
    );
    if (
      !questionOrders ||
      questionOrders.has(questionOrder) ||
      placementIdentities.has(placement.placementIdentity)
    ) {
      return yield* responseIntegrity(
        "TRYOUT_PLACEMENT_DUPLICATE",
        "Try-out placement inventory contains a duplicate identity or slot."
      );
    }

    questionOrders.add(questionOrder);
    placementIdentities.add(placement.placementIdentity);
  }

  for (const snapshot of input.snapshots) {
    const questionOrders = questionOrdersBySection.get(
      snapshot.sectionIdentity
    );
    if (questionOrders?.size !== snapshot.questionCount) {
      return yield* responseIntegrity(
        "TRYOUT_PLACEMENT_COUNT_MISMATCH",
        "Try-out placement slots do not match its frozen section snapshot."
      );
    }
  }

  return input.placements;
});

/** Validates and indexes response rows against immutable placements. */
export const indexTryoutResponses = Effect.fn(
  "tryouts.response.indexIntegrity"
)(function* (input: {
  readonly attemptId: Id<"tryoutAttempts">;
  readonly links: readonly ResponsePlacementLink[];
  readonly responses: readonly TryoutResponse[];
}) {
  const linksByPlacement = new Map<
    Id<"tryoutAttemptPlacements">,
    ResponsePlacementLink
  >();
  for (const link of input.links) {
    if (
      link.placement.tryoutAttemptId !== input.attemptId ||
      linksByPlacement.has(link.placement._id)
    ) {
      return yield* responseIntegrity(
        "TRYOUT_RESPONSE_LINK_MISMATCH",
        "Try-out response placement links do not match the attempt."
      );
    }
    linksByPlacement.set(link.placement._id, link);
  }

  const responsesByPlacement = new Map<
    Id<"tryoutAttemptPlacements">,
    TryoutResponse
  >();
  for (const response of input.responses) {
    const link = linksByPlacement.get(response.placementId);
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
    if (responsesByPlacement.has(response.placementId)) {
      return yield* responseIntegrity(
        "TRYOUT_RESPONSE_PLACEMENT_DUPLICATE",
        "Try-out placement has more than one response."
      );
    }

    const selectedOptionId = response.selectedOptionId;
    if (selectedOptionId === undefined) {
      if (response.textAnswer === undefined) {
        return yield* responseIntegrity(
          "TRYOUT_RESPONSE_CHOICE_MISMATCH",
          "Try-out response has no answer snapshot."
        );
      }
    } else {
      const choice = link.placement.choiceSnapshots.find(
        (candidate) => candidate.optionKey === selectedOptionId
      );
      if (!choice || choice.isCorrect !== response.isCorrect) {
        return yield* responseIntegrity(
          "TRYOUT_RESPONSE_CHOICE_MISMATCH",
          "Try-out response differs from its frozen choice snapshot."
        );
      }
    }

    responsesByPlacement.set(response.placementId, response);
  }

  return responsesByPlacement;
});

/** Creates one typed fail-closed response graph error. */
function responseIntegrity(
  code: TryoutResponseIntegrityError["code"],
  message: string
) {
  return new TryoutResponseIntegrityError({ code, message });
}
