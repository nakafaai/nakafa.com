import type { Docs } from "@repo/backend/confect/_generated/docs";
import type { Id } from "@repo/backend/confect/_generated/id";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  PracticeError,
  type PracticeTarget,
} from "@repo/backend/confect/practice/sessions.spec";
import { loadActiveAssessment } from "@repo/backend/confect/tryouts/active";
import { freezeAttempt } from "@repo/backend/confect/tryouts/start/freeze";
import { loadTryoutStartSource } from "@repo/backend/confect/tryouts/start/source";
import { Array as Arr, Effect, Option, Struct } from "effect";

/** A session's refusal when it, or the question asked about, is not the caller's. */
const missing = () =>
  new PracticeError({
    code: "PRACTICE_MISSING",
    message: "This practice is not yours, or it does not exist.",
  });

/** The caller's practice of one section of a set, if they started one. */
export const findPracticeSession = Effect.fn("practice.session.find")(
  function* (userId: Id<"users">, target: PracticeTarget) {
    return yield* (yield* DatabaseReader)
      .table("practiceSessions")
      .get(
        "by_userId_and_set_and_sectionKey",
        userId,
        target.countryKey,
        target.examKey,
        target.trackKey,
        target.setKey,
        target.sectionKey
      )
      .pipe(
        Effect.asSome,
        Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
        Effect.orDie
      );
  }
);

/** The caller's session by its ID, refused as missing when it is someone else's or gone. */
export const requirePracticeSession = Effect.fn("practice.session.require")(
  function* (userId: Id<"users">, sessionId: Id<"practiceSessions">) {
    const session = yield* (yield* DatabaseReader)
      .table("practiceSessions")
      .get(sessionId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (session?.userId !== userId) {
      return yield* missing();
    }
    return session;
  }
);

/** The frozen questions of a session, in their order. */
export const readPracticeQuestions = Effect.fn("practice.session.questions")(
  function* (session: Docs["practiceSessions"]) {
    return yield* (yield* DatabaseReader)
      .table("practiceQuestions")
      .index("by_practiceSessionId_and_questionOrder", (query) =>
        query.eq("practiceSessionId", session._id)
      )
      .take(session.questionCount)
      .pipe(Effect.orDie);
  }
);

/** The checked answers of a session, at most one per question. */
export const readPracticeAnswers = Effect.fn("practice.session.answers")(
  function* (session: Docs["practiceSessions"]) {
    return yield* (yield* DatabaseReader)
      .table("practiceAnswers")
      .index("by_practiceSessionId_and_checkedAt", (query) =>
        query.eq("practiceSessionId", session._id)
      )
      .take(session.questionCount)
      .pipe(Effect.orDie);
  }
);

/**
 * Freezes one section of a set from the active release, as a try-out start freezes its paper
 * (`freezeAttempt`): the snapshot and release it read, its paper, and the section's places in order. A
 * set without the section, or a paper the freeze refuses, cannot be practised.
 */
const freezeSection = Effect.fn("practice.session.freeze")(function* (
  target: PracticeTarget
) {
  const active = yield* loadActiveAssessment();
  const source = yield* loadTryoutStartSource(active, {
    countryKey: target.countryKey,
    examKey: target.examKey,
    locale: target.locale,
    setKey: target.setKey,
    trackKey: target.trackKey,
  });
  const frozen = yield* freezeAttempt({
    items: source.items,
    paper: source.paper.paper,
    profile: source.profile.profile,
    sections: source.sections,
  }).pipe(
    Effect.catchTag("TryoutFreezeError", (error) =>
      Effect.fail(
        new PracticeError({
          code: "PRACTICE_START_FAILED",
          message: error.message,
        })
      )
    )
  );
  const places = Arr.filter(
    frozen.placements,
    (place) => place.sectionKey === target.sectionKey
  );
  if (Arr.isReadonlyArrayEmpty(places)) {
    return yield* missing();
  }
  return { active, paper: source.paper, places };
});

/** Writes a section's frozen places as the questions of one session. */
const writeQuestions = Effect.fn("practice.session.writeQuestions")(function* (
  sessionId: Id<"practiceSessions">,
  places: Effect.Success<ReturnType<typeof freezeSection>>["places"]
) {
  const writer = yield* DatabaseWriter;
  yield* Effect.forEach(
    places,
    (place) =>
      writer
        .table("practiceQuestions")
        .insert({
          ...Struct.omit(place, ["sectionKey"]),
          practiceSessionId: sessionId,
        })
        .pipe(Effect.orDie),
    { discard: true }
  );
});

/** Opens the caller's practice of one section: the session they hold, or one frozen now from the active release. */
export const openPracticeSession = Effect.fn("practice.session.open")(
  function* (userId: Id<"users">, target: PracticeTarget, now: number) {
    const existing = yield* findPracticeSession(userId, target);
    if (Option.isSome(existing)) {
      return existing.value._id;
    }
    const frozen = yield* freezeSection(target);
    const sessionId = yield* (yield* DatabaseWriter)
      .table("practiceSessions")
      .insert({
        appLocale: target.locale,
        assessmentSnapshotId: frozen.active.snapshotId,
        countryKey: target.countryKey,
        examKey: target.examKey,
        lastActivityAt: now,
        paper: { hash: frozen.paper.hash, id: frozen.paper.paper.id },
        questionCount: frozen.places.length,
        releaseId: frozen.active.releaseId,
        sectionKey: target.sectionKey,
        setKey: target.setKey,
        startedAt: now,
        trackKey: target.trackKey,
        userId,
      })
      .pipe(Effect.orDie);
    yield* writeQuestions(sessionId, frozen.places);
    return sessionId;
  }
);

/**
 * Starts the caller's session again: every checked answer goes, and a session frozen from an earlier
 * release freezes the active one, so starting again also brings the section's current questions.
 */
export const restartPracticeSession = Effect.fn("practice.session.restart")(
  function* (
    userId: Id<"users">,
    sessionId: Id<"practiceSessions">,
    now: number
  ) {
    const session = yield* requirePracticeSession(userId, sessionId);
    const writer = yield* DatabaseWriter;
    const answers = yield* readPracticeAnswers(session);
    yield* Effect.forEach(
      answers,
      (answer) =>
        writer.table("practiceAnswers").delete(answer._id).pipe(Effect.orDie),
      { discard: true }
    );
    const active = yield* loadActiveAssessment();
    if (active.releaseId === session.releaseId) {
      yield* writer
        .table("practiceSessions")
        .patch(session._id, { lastActivityAt: now, startedAt: now })
        .pipe(Effect.orDie);
      return session._id;
    }
    const questions = yield* readPracticeQuestions(session);
    yield* Effect.forEach(
      questions,
      (question) =>
        writer
          .table("practiceQuestions")
          .delete(question._id)
          .pipe(Effect.orDie),
      { discard: true }
    );
    const frozen = yield* freezeSection({
      countryKey: session.countryKey,
      examKey: session.examKey,
      locale: session.appLocale,
      sectionKey: session.sectionKey,
      setKey: session.setKey,
      trackKey: session.trackKey,
    });
    yield* writer
      .table("practiceSessions")
      .patch(session._id, {
        assessmentSnapshotId: frozen.active.snapshotId,
        lastActivityAt: now,
        paper: { hash: frozen.paper.hash, id: frozen.paper.paper.id },
        questionCount: frozen.places.length,
        releaseId: frozen.active.releaseId,
        startedAt: now,
      })
      .pipe(Effect.orDie);
    yield* writeQuestions(session._id, frozen.places);
    return session._id;
  }
);
