import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import tryoutAttemptPlacements from "@repo/backend/confect/_generated/tables/tryoutAttemptPlacements";
import tryoutAttempts from "@repo/backend/confect/_generated/tables/tryoutAttempts";
import tryoutResponses from "@repo/backend/confect/_generated/tables/tryoutResponses";
import tryoutSectionAttempts from "@repo/backend/confect/_generated/tables/tryoutSectionAttempts";
import { make } from "@repo/backend/confect/assessment/gate/admit";
import type { EndReason } from "@repo/backend/confect/assessment/gate/end";
import type { Version } from "@repo/backend/confect/assessment/gate/rules";
import { Answerable } from "@repo/backend/confect/assessment/gate/store";
import { evaluate } from "@repo/backend/confect/response/evaluation";
import {
  type Evaluated,
  ResponseSpec,
} from "@repo/backend/confect/response/model";
import type { SectionTarget } from "@repo/backend/confect/tryouts/mutations/sections.spec";
import {
  toTryoutFailure,
  toTryoutStale,
} from "@repo/backend/confect/tryouts/refusal";
import { writeAnswer } from "@repo/backend/confect/tryouts/response/answer";
import {
  indexTryoutResponses,
  requireTryoutResponseSectionSnapshot,
  validateTryoutResponsePlacements,
} from "@repo/backend/confect/tryouts/response/integrity";
import {
  type SaveTryoutResponseArgs,
  toTryoutResponseError,
  toTryoutSelectionError,
} from "@repo/backend/confect/tryouts/response/spec";
import { readVersion } from "@repo/backend/confect/tryouts/response/version";
import { toTryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import { finalizeSectionAttempt } from "@repo/backend/confect/tryouts/runtime/finish";
import { loadSectionAttempt } from "@repo/backend/confect/tryouts/runtime/sectionAttempt";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Effect, flow, Option, Schema } from "effect";

/** The rows an admitted try-out finish works on. */
const Live = Schema.Struct({
  attempt: tryoutAttempts.Doc,
  section: tryoutSectionAttempts.Doc,
});
type Live = typeof Live.Type;

/**
 * The rows an admitted try-out answer works on, beside what the gate checks:
 * its frozen response, and the version of the question's latest write.
 */
const Answering = Schema.Struct({
  ...Live.fields,
  ...Answerable.fields,
  placement: tryoutAttemptPlacements.Doc,
  response: ResponseSpec,
  stored: Schema.Option(tryoutResponses.Doc),
});
type Answering = typeof Answering.Type;

/** A consumer try-out attempt as the gate sees it: bound to no device, and never locked. */
function attemptOf(attempt: Live["attempt"]) {
  return {
    binding: { kind: "free" } as const,
    deadline: attempt.expiresAt,
    state: attemptStateOf(attempt.status),
  };
}

/** The gate's state of a try-out attempt: in progress, submitted once completed, expired when its time ran out. */
function attemptStateOf(status: Live["attempt"]["status"]) {
  if (status === "in-progress") {
    return "inProgress" as const;
  }
  return status === "completed" ? ("submitted" as const) : ("expired" as const);
}

/** Reads one attempt by ID, none when it does not exist. Storage failures die; each write masks them. */
const loadAttempt = Effect.fn("tryouts.gate.loadAttempt")(function* (
  attemptId: Id<"tryoutAttempts">
) {
  const reader = yield* DatabaseReader;
  return yield* reader
    .table("tryoutAttempts")
    .get(attemptId)
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIdFailure", () => Effect.succeedNone),
      Effect.orDie
    );
});

/** Reads one section by its attempt-owned key, none unless it is running. Storage failures die like those of the other loads. */
const loadRunning = Effect.fn("tryouts.gate.loadRunning")(function* (
  attemptId: Id<"tryoutAttempts">,
  sectionKey: string
) {
  const section = yield* loadSectionAttempt({ attemptId, sectionKey }).pipe(
    Effect.orDie
  );
  return Option.filter(
    Option.fromNullOr(section),
    ({ status }) => status === "in-progress"
  );
});

/** Reads the stored responses of one placement, at most two so a duplicate shows. */
const loadResponses = Effect.fn("tryouts.gate.loadResponses")(function* (
  placementId: Id<"tryoutAttemptPlacements">
) {
  const reader = yield* DatabaseReader;
  return yield* reader
    .table("tryoutResponses")
    .index("by_placementId", (query) => query.eq("placementId", placementId))
    .take(2)
    .pipe(Effect.orDie);
});

/**
 * Checks a running section against its attempt's frozen snapshot, and the
 * placement against both. It reads nothing, so it runs before the deadline.
 */
const verifySection = Effect.fn("tryouts.gate.verifySection")(function* (
  attempt: Live["attempt"],
  section: Live["section"],
  placement: Answering["placement"]
) {
  const snapshot = yield* requireTryoutResponseSectionSnapshot(
    attempt,
    section
  );
  yield* validateTryoutResponsePlacements(attempt._id, snapshot, [placement]);
});

/**
 * Reads the question's stored answer and checks it against its links and
 * frozen evaluation. It runs only after the deadline passed unrefused, as the
 * answer write of the try-out runtime always did, so an answer that arrives
 * too late is refused for its time before the stored rows are read.
 */
const loadAnswering = Effect.fn("tryouts.gate.loadAnswering")(function* (
  attempt: Live["attempt"],
  section: Live["section"],
  placement: Answering["placement"]
) {
  const responses = yield* loadResponses(placement._id);
  yield* indexTryoutResponses({
    attemptId: attempt._id,
    links: [{ placement, sectionAttemptId: section._id }],
    responses,
  });
  const stored = Arr.head(responses);
  return {
    attempt,
    placement,
    response: placement.responseSpec,
    section,
    stored,
    version: readVersion(placement, stored),
  };
});

/**
 * The target of one answer: its placement and attempt, then, only for the
 * attempt's owner, its running section, whose stored answer loads last.
 */
const loadPlacement = Effect.fn("tryouts.gate.loadPlacement")(function* (
  placementId: Id<"tryoutAttemptPlacements">
) {
  const reader = yield* DatabaseReader;
  const placement = yield* reader
    .table("tryoutAttemptPlacements")
    .get(placementId)
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIdFailure", () => Effect.succeedNone),
      Effect.orDie
    );
  if (Option.isNone(placement)) {
    return Option.none();
  }
  const placed = placement.value;
  const attempt = yield* loadAttempt(placed.tryoutAttemptId);
  return Option.map(attempt, (loaded) => ({
    attempt: attemptOf(loaded),
    owner: loaded.userId,
    section: loadRunning(loaded._id, placed.sectionKey).pipe(
      Effect.map(
        Option.map((section) => ({
          deadline: section.expiresAt,
          live: loadAnswering(loaded, section, placed),
          verify: verifySection(loaded, section, placed),
        }))
      )
    ),
  }));
});

/** The target of one finish: its attempt, then, only for its owner, its running section. */
const loadSection = Effect.fn("tryouts.gate.loadSection")(function* (
  target: SectionTarget
) {
  const attempt = yield* loadAttempt(target.attemptId);
  return Option.map(attempt, (loaded) => ({
    attempt: attemptOf(loaded),
    owner: loaded.userId,
    section: loadRunning(loaded._id, target.sectionKey).pipe(
      Effect.map(
        Option.map((section) => ({
          deadline: section.expiresAt,
          live: Effect.succeed({ attempt: loaded, section }),
          verify: Effect.void,
        }))
      )
    ),
  }));
});

/** Ends one running section and scores it, the attempt too once every section ended. */
const finishSection = Effect.fn("tryouts.gate.finishSection")(function* (
  live: Live,
  reason: EndReason,
  now: number
) {
  yield* finalizeSectionAttempt({
    attempt: live.attempt,
    endReason: reason,
    now,
    section: live.section,
  });
});

const gate = make({
  answer: (
    live: Answering,
    answer: Option.Option<Evaluated>,
    now: number,
    version: Version
  ) =>
    writeAnswer({
      answer,
      attempt: live.attempt,
      now,
      placement: live.placement,
      section: live.section,
      stored: live.stored,
      version,
    }),
  finish: finishSection,
  placement: loadPlacement,
  section: loadSection,
});

/**
 * Consumer try-out writes admitted through the live-attempt gate (ADR 0013).
 * Each fails only with errors its function already declares; unexpected
 * storage failures are masked with their cause kept.
 *
 * This file is the try-out store of the gate, not a second guard sequence.
 * Owner: ADR 0013 and ADR 0031. Exit: the engine cutover, which replaces the
 * try-out runtime and its tables with the assessment engine and deletes this
 * file with the rest of `confect/tryouts`.
 */
export const tryoutGate = {
  /** Saves, replaces, or clears (`null`) one answer of the caller's running section. */
  answer: Effect.fn("tryouts.gate.answer")(
    function* (owner: Id<"users">, args: SaveTryoutResponseArgs) {
      yield* gate.answer({
        device: Option.none(),
        owner,
        placement: args.placementId,
        value: (live) =>
          Effect.transposeOption(
            Option.map(Option.fromNullOr(args.selection), (selection) =>
              Effect.fromResult(evaluate(live.response, selection))
            )
          ),
        version: args.version,
      });
    },
    Effect.catchTags({
      AttemptRefused: flow(toTryoutFailure.answer, Effect.fail),
      ResponseRejected: flow(toTryoutSelectionError, Effect.fail),
      Stale: flow(toTryoutStale, Effect.fail),
    }),
    Effect.catchDefect(flow(toTryoutResponseError, Effect.fail))
  ),
  /** Ends and scores the caller's running section. */
  finish: Effect.fn("tryouts.gate.finish")(
    function* (owner: Id<"users">, section: SectionTarget) {
      yield* gate.finish({
        device: Option.none(),
        owner,
        section,
        settled: "refuse",
      });
    },
    Effect.catchTag(
      "AttemptRefused",
      flow(toTryoutFailure.finish, Effect.fail)
    ),
    Effect.catchDefect(flow(toTryoutRuntimeError, Effect.fail))
  ),
};
