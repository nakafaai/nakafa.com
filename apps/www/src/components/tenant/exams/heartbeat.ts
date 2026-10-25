import {
  PRESENCE_INTERVAL,
  type PresenceSession,
  type PresenceToken,
} from "@repo/backend/confect/exams/presence";
import { randomUuid } from "@repo/utilities/uuid";
import { Effect, Option, Ref, Schedule, Semaphore } from "effect";

/** What the heartbeat of one open editor calls: the room's join and leave, and the tab's visibility. */
interface HeartbeatCalls<E> {
  /** Whether the editor's tab shows now. */
  readonly isVisible: () => boolean;
  /** Joins the session to the exam's room, or keeps it there, and answers the token that closes it. */
  readonly join: (
    session: typeof PresenceSession.Type
  ) => Effect.Effect<typeof PresenceToken.Type, E>;
  /** Closes the session that the token names. */
  readonly leave: (token: typeof PresenceToken.Type) => Effect.Effect<void>;
}

/**
 * The presence of one open editor in its exam's room, as one session with its own id (ADR 0028).
 * `run` beats at once and then every `PRESENCE_INTERVAL`: a shown tab joins or keeps its session,
 * and a tab that is hidden at a beat leaves, so a tab left in the background costs nothing and a
 * short look at another tab changes nothing. `run` leaves when it ends, and a join that is under
 * way finishes first, so the session it opens is the one that closes. `returned` joins at once
 * when the tab shows again while `run` runs, and `leave` closes the session at once when the page
 * goes away.
 */
export const makeHeartbeat = Effect.fn("www.exams.heartbeat")(function* <E>(
  calls: HeartbeatCalls<E>
) {
  const session = yield* randomUuid;
  const held = yield* Ref.make(Option.none<typeof PresenceToken.Type>());
  const turn = yield* Semaphore.make(1);
  const running = yield* Ref.make(true);

  const leave = Ref.getAndSet(held, Option.none()).pipe(
    Effect.flatMap(
      Option.match({ onNone: () => Effect.void, onSome: calls.leave })
    )
  );

  const beat = Effect.suspend(() =>
    calls.isVisible()
      ? calls
          .join(session)
          .pipe(Effect.flatMap((token) => Ref.set(held, Option.some(token))))
      : leave
  ).pipe(Effect.uninterruptible, Semaphore.withPermits(turn, 1));

  const returned = Effect.all([Ref.get(running), Ref.get(held)]).pipe(
    Effect.flatMap(([isRunning, token]) =>
      isRunning && Option.isNone(token) ? beat : Effect.void
    )
  );

  return {
    leave,
    returned,
    run: beat.pipe(
      Effect.repeat(Schedule.spaced(PRESENCE_INTERVAL)),
      Effect.ensuring(Ref.set(running, false).pipe(Effect.andThen(leave))),
      Effect.asVoid
    ),
  };
});
