import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { ConvexTaggedError } from "@repo/backend/convex/lib/effect";
import { evaluateTryoutResponse } from "@repo/backend/convex/tryouts/response/evaluation";
import {
  resolvePlacementResponseSpec,
  resolveStoredResponseSelection,
} from "@repo/backend/convex/tryouts/response/legacy";
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
      code: Schema.Literals([
        "TRYOUT_PLACEMENT_COUNT_MISMATCH",
        "TRYOUT_PLACEMENT_DUPLICATE",
        "TRYOUT_RESPONSE_SELECTION_MISMATCH",
        "TRYOUT_RESPONSE_COUNT_EXCEEDED",
        "TRYOUT_RESPONSE_LINK_MISMATCH",
        "TRYOUT_RESPONSE_PLACEMENT_DUPLICATE",
        "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH",
      ]),
      message: Schema.String,
    }
  )
  implements ConvexTaggedError {}
/** Indexes one unique frozen section graph by immutable identity. */
export const validateTryoutSectionSnapshots = Effect.fn(
  "tryouts.response.validateSectionSnapshots"
)(function* (snapshots: readonly TryoutSectionSnapshot[]) {
  const snapshotsByIdentity = new Map<string, TryoutSectionSnapshot>();
  const sectionKeys = new Set<string>();
  const sectionOrders = new Set<number>();
  for (const snapshot of snapshots) {
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
  const snapshotsByIdentity = yield* validateTryoutSectionSnapshots(
    input.snapshots
  );
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
  const questionOrdersBySection = new Map<string, Set<number>>();
  for (const snapshot of input.snapshots) {
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
    if (
      response.selection !== undefined &&
      (response.isComplete === undefined ||
        response.selectedOptionId !== undefined)
    ) {
      return yield* responseIntegrity(
        "TRYOUT_RESPONSE_SELECTION_MISMATCH",
        "Try-out response has an ambiguous learner selection."
      );
    }
    const responseSpec = yield* resolvePlacementResponseSpec(
      link.placement
    ).pipe(
      Effect.mapError(() =>
        responseIntegrity(
          "TRYOUT_RESPONSE_SELECTION_MISMATCH",
          "Try-out placement has an invalid frozen response definition."
        )
      )
    );
    const selection = yield* resolveStoredResponseSelection(response).pipe(
      Effect.mapError(() =>
        responseIntegrity(
          "TRYOUT_RESPONSE_SELECTION_MISMATCH",
          "Try-out response has no supported learner selection."
        )
      )
    );
    const evaluated = yield* evaluateTryoutResponse(
      responseSpec,
      selection
    ).pipe(
      Effect.mapError(() =>
        responseIntegrity(
          "TRYOUT_RESPONSE_SELECTION_MISMATCH",
          "Try-out response differs from its frozen response definition."
        )
      )
    );
    const isComplete = response.isComplete ?? true;
    if (
      evaluated.isComplete !== isComplete ||
      evaluated.isCorrect !== response.isCorrect
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
/** Creates one typed fail-closed response graph error. */
function responseIntegrity(
  code: TryoutResponseIntegrityError["code"],
  message: string
) {
  return new TryoutResponseIntegrityError({ code, message });
}
