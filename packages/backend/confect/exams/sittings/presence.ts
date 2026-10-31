import { Presence } from "@convex-dev/presence";
import { components } from "@repo/backend/confect/_generated/components";
import type {
  ExamAttemptsDoc,
  ExamSittingsDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DocumentIds,
  MutationCtx,
  QueryCtx,
} from "@repo/backend/confect/_generated/services";
import { rules } from "@repo/backend/confect/assessment/gate/rules";
import {
  PRESENCE_INTERVAL,
  type PresenceSession,
} from "@repo/backend/confect/exams/presence";
import { Sitting } from "@repo/backend/confect/exams/sittings/access";
import { isAway } from "@repo/backend/confect/exams/sittings/dashboard";
import {
  sectionOf,
  sittingGate,
} from "@repo/backend/confect/exams/sittings/gate";
import { toSittingError } from "@repo/backend/confect/exams/sittings/refusal";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Array as Arr, Duration, Effect, HashSet, Option } from "effect";

/** The presence component, whose rooms here are sittings and whose users are attempts (K25, K26). */
const presence = new Presence(components.presence);

/** The most seats of one room that one read holds. */
const ROOM_SEATS = 300;

/**
 * Keeps a student's attempt present in its room: the device that owns the open attempt beats while its tab shows,
 * and the component closes a session that stays silent for 2.5 intervals. That silence is how the proctor learns of
 * a lost connection while it lasts, since the device can only report one once it is back. The answer is the token
 * that closes the session.
 */
export const beat = Effect.fn("exams.sittings.presence.beat")(function* (args: {
  attemptId: ExamAttemptsDoc["_id"];
  deviceId: string;
  session: typeof PresenceSession.Type;
}) {
  const member = yield* Member;
  const { live } = yield* sittingGate
    .admit(
      rules.screen,
      member.person._id,
      Option.some(args.deviceId),
      sectionOf({
        attemptId: args.attemptId,
        person: member.person,
        tenantId: member.tenant._id,
      })
    )
    .pipe(
      Effect.catchTag("AttemptRefused", (refusal) =>
        Effect.fail(toSittingError(refusal))
      )
    );
  const ctx = yield* MutationCtx;
  const tokens = yield* Effect.tryPromise(() =>
    presence.heartbeat(
      ctx,
      live.attempt.sitting,
      live.attempt._id,
      args.session,
      Duration.toMillis(PRESENCE_INTERVAL)
    )
  ).pipe(Effect.orDie);
  return { token: tokens.sessionToken };
});

/** The room's attempts whose sessions have all closed, each with when the last one did. */
const silentAttempts = Effect.fn("exams.sittings.presence.silent")(function* (
  sittingId: ExamSittingsDoc["_id"]
) {
  const ctx = yield* QueryCtx;
  const ids = yield* DocumentIds;
  const rows = yield* Effect.tryPromise(() =>
    presence.listRoom(ctx, sittingId, false, ROOM_SEATS)
  ).pipe(Effect.orDie);
  return yield* Effect.forEach(
    Arr.filter(rows, (row) => !row.online),
    (row) =>
      ids.parse("examAttempts", row.userId).pipe(
        Effect.flatMap(Effect.fromOption),
        Effect.orDie,
        Effect.map((attemptId) => ({
          attemptId,
          since: row.lastDisconnected,
        }))
      )
  );
});

/**
 * The students of a room who went silent, for the proctor's seats. A heartbeat writes only its session, so this
 * read runs again only when a student's connection comes or goes, however many students beat.
 */
export const offlineSeats = Effect.fn("exams.sittings.presence.offline")(
  function* () {
    return yield* silentAttempts((yield* Sitting)._id);
  }
);

/** How one seat reads at a glance. A student who left the exam is away, whatever their connection does. */
const seatKind = Effect.fn("exams.sittings.presence.kind")(function* (
  attempt: ExamAttemptsDoc,
  silent: HashSet.HashSet<ExamAttemptsDoc["_id"]>
) {
  if (attempt.state === "locked") {
    return "locked" as const;
  }
  if (attempt.state !== "inProgress") {
    return "finished" as const;
  }
  const latest = yield* (yield* DatabaseReader)
    .table("examSignals")
    .index(
      "by_attemptId_and_at",
      (query) => query.eq("attempt", attempt._id),
      "desc"
    )
    .first()
    .pipe(Effect.orDie);
  if (Option.exists(latest, isAway)) {
    return "away" as const;
  }
  return HashSet.has(silent, attempt._id)
    ? ("offline" as const)
    : ("working" as const);
});

/**
 * How one room stands, as the exam's rooms show it (K26). It reads every seat of the room, so the page asks for it
 * once every 15 seconds, and only while it shows, and nothing subscribes to it: a room's seats change on every
 * entry and every signal, and a summary that ran again on each of them would read the room each time.
 */
export const roomSeats = Effect.fn("exams.sittings.presence.seats")(
  function* () {
    const sitting = yield* Sitting;
    const attempts = yield* (yield* DatabaseReader)
      .table("examAttempts")
      .index("by_sittingId", (query) => query.eq("sitting", sitting._id))
      .take(ROOM_SEATS)
      .pipe(Effect.orDie);
    const silent = HashSet.fromIterable(
      Arr.map(yield* silentAttempts(sitting._id), (seat) => seat.attemptId)
    );
    const kinds = yield* Effect.forEach(attempts, (attempt) =>
      seatKind(attempt, silent)
    );
    const seatsOf = (kind: (typeof kinds)[number]) =>
      Arr.filter(kinds, (seat) => seat === kind).length;
    return {
      away: seatsOf("away"),
      finished: seatsOf("finished"),
      locked: seatsOf("locked"),
      offline: seatsOf("offline"),
      working: seatsOf("working"),
    };
  }
);
