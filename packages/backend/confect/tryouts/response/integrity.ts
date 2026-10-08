import type { Docs } from "@repo/backend/confect/_generated/docs";
import { evaluate } from "@repo/backend/confect/response/evaluation";
import { Outcome } from "@repo/backend/confect/response/model";
import { readOutcome } from "@repo/backend/confect/tryouts/response/outcome";
import { TryoutResponseIntegrityError } from "@repo/backend/confect/tryouts/response/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Effect, Schema } from "effect";

type TryoutPlacement = Docs["tryoutAttemptPlacements"];
type TryoutResponse = Docs["tryoutResponses"];
type TryoutAttempt = Docs["tryoutAttempts"];
type TryoutSectionAttempt = Docs["tryoutSectionAttempts"];
type TryoutSectionSnapshot = TryoutAttempt["sectionSnapshots"][number];
interface ResponsePlacementLink {
  readonly placement: TryoutPlacement;
  readonly sectionAttemptId: Id<"tryoutSectionAttempts">;
}
/** Indexes one unique frozen section graph by immutable identity. */
export const validateTryoutSectionSnapshots = Effect.fn(
  "tryouts.response.validateSectionSnapshots"
)(function* (snapshots: readonly TryoutSectionSnapshot[]) {
  const snapshotsByIdentity = new Map<string, TryoutSectionSnapshot>();
  const sectionKeys = new Set<string>();
  const sectionOrders = new Set<number>();
  for (const snapshot of snapshots) {
    if (
      !Number.isSafeInteger(snapshot.questionCount) ||
      snapshot.questionCount < 1
    ) {
      return yield* responseIntegrity(
        "TRYOUT_PLACEMENT_COUNT_MISMATCH",
        "Try-out sections must contain a positive whole number of questions."
      );
    }
    if (
      snapshotsByIdentity.has(snapshot.sectionIdentity) ||
      sectionKeys.has(snapshot.sectionKey) ||
      sectionOrders.has(snapshot.sectionOrder)
    ) {
      return yield* responseIntegrity(
        "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH",
        "Try-out section snapshots contain a duplicate identity, key, or order."
      );
    }
    snapshotsByIdentity.set(snapshot.sectionIdentity, snapshot);
    sectionKeys.add(snapshot.sectionKey);
    sectionOrders.add(snapshot.sectionOrder);
  }
  return snapshotsByIdentity;
});
/** Resolves and validates the frozen section owned by one response graph. */
export const requireTryoutResponseSectionSnapshot = Effect.fn(
  "tryouts.response.requireSectionSnapshot"
)(function* (attempt: TryoutAttempt, section: TryoutSectionAttempt) {
  const snapshotsByIdentity = yield* validateTryoutSectionSnapshots(
    attempt.sectionSnapshots
  );
  const snapshot = snapshotsByIdentity.get(section.sectionIdentity);
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
    Arr.some(
      placements,
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
  readonly placements: readonly TryoutPlacement[];
  readonly snapshots: readonly TryoutSectionSnapshot[];
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
  const snapshotsByIdentity = yield* validateTryoutSectionSnapshots(
    input.snapshots
  );
  const snapshotQuestionCount = Arr.reduce(
    input.snapshots,
    0,
    (total, snapshot) => total + snapshot.questionCount
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
  const sections = new Map(
    Array.from(snapshotsByIdentity, ([identity, snapshot]) => [
      identity,
      {
        questionOrders: new Set<number>(),
        snapshot,
      },
    ])
  );
  const placementIdentities = new Set<string>();
  for (const placement of input.placements) {
    const section = sections.get(placement.sectionIdentity);
    if (
      !section ||
      placement.tryoutAttemptId !== input.attemptId ||
      placement.sectionKey !== section.snapshot.sectionKey
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
      questionOrder > section.snapshot.questionCount
    ) {
      return yield* responseIntegrity(
        "TRYOUT_PLACEMENT_COUNT_MISMATCH",
        "Try-out placement slots do not match its frozen section snapshot."
      );
    }
    const { questionOrders } = section;
    if (
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
  return input.placements;
});
/** Validates response rows against the caller's verified placement inventory. */
export const indexTryoutResponses = Effect.fn(
  "tryouts.response.indexIntegrity"
)(function* (input: {
  readonly attemptId: Id<"tryoutAttempts">;
  readonly links: readonly ResponsePlacementLink[];
  readonly responses: readonly TryoutResponse[];
}) {
  const linksByPlacement = new Map(
    Arr.map(input.links, (link) => [link.placement._id, link])
  );
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
    const evaluated = yield* Effect.fromResult(
      evaluate(link.placement.responseSpec, response.selection)
    ).pipe(
      Effect.mapError(() =>
        responseIntegrity(
          "TRYOUT_RESPONSE_SELECTION_MISMATCH",
          "Try-out response differs from its frozen response definition."
        )
      )
    );
    if (
      evaluated.isComplete !== response.isComplete ||
      !confirms(evaluated.outcome, readOutcome(response))
    ) {
      return yield* responseIntegrity(
        "TRYOUT_RESPONSE_SELECTION_MISMATCH",
        "Try-out response evaluation differs from its stored result."
      );
    }
    responsesByPlacement.set(response.placementId, response);
  }
  return responsesByPlacement;
});
const sameOutcome = Schema.toEquivalence(Outcome);

/**
 * Reports whether a deterministic evaluation reproduces a stored outcome. An
 * evaluation it cannot decide is `pending`, so it defers to the stored one,
 * which the grader may already have decided.
 */
function confirms(evaluated: Outcome, stored: Outcome) {
  return evaluated.status === "pending" || sameOutcome(evaluated, stored);
}
/** Creates one typed fail-closed response graph error. */
function responseIntegrity(
  code: TryoutResponseIntegrityError["code"],
  message: string
) {
  return new TryoutResponseIntegrityError({
    code,
    message,
  });
}
