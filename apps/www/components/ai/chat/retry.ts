import {
  Effect,
  Exit,
  Fiber,
  MutableRef,
  Option,
  Schema,
  type Scope,
} from "effect";

/**
 * Where the open wait stands: still waiting for the server, answered and holding
 * its subscription, or ended without an answer.
 */
const PhaseSchema = Schema.Literals(["pending", "answered", "ended"]);
type Phase = typeof PhaseSchema.Type;

/** What a wait reports: the server's answer, or the end of the wait without one. */
interface AnswerCallbacks {
  readonly answered: () => void;
  readonly ended: () => void;
}

/** The one open wait: its fiber, the callbacks it reports to, and where it stands. */
interface OpenWait {
  readonly fiber: Fiber.Fiber<void, unknown>;
  readonly on: AnswerCallbacks;
  readonly phase: MutableRef.MutableRef<Phase>;
}

/**
 * Starts the wait for a share link's answer, and holds the one wait that is open.
 * Each wait is forked detached, so the caller that started it can finish while
 * the wait goes on. A new retry or a dispose ends the open wait first.
 *
 * The controller runs nothing. Its functions return effects, and the caller
 * decides where they run.
 */
export function makeAnswerRetry() {
  const openWait = MutableRef.make<Option.Option<OpenWait>>(Option.none());

  /** Takes the open wait out of its slot, and returns it. */
  const takeOpenWait = Effect.sync(() => {
    const open = MutableRef.get(openWait);
    MutableRef.set(openWait, Option.none());
    return open;
  });

  return {
    /**
     * Ends the open wait without reporting it, then starts `wait` detached from
     * the caller. When the server answers, the wait calls `on.answered` and holds
     * its subscription until `release`, a new retry, or a dispose ends it. When
     * the wait fails, it calls `on.ended`. A wait that a new retry replaces calls
     * neither, so the state its caller keeps stays with the new wait.
     */
    retry: Effect.fn("chat.share.retry")(function* <E>(
      wait: Effect.Effect<void, E, Scope.Scope>,
      on: AnswerCallbacks
    ) {
      const previous = yield* takeOpenWait;
      if (Option.isSome(previous)) {
        yield* Fiber.interrupt(previous.value.fiber);
      }
      const phase = MutableRef.make<Phase>("pending");
      // The wait starts at once. An interruption reports nothing here, because
      // the caller that interrupted the wait decides what follows.
      const fiber = yield* wait.pipe(
        Effect.onExit((exit) =>
          Effect.sync(() => {
            if (Exit.isSuccess(exit)) {
              MutableRef.set(phase, "answered");
              on.answered();
              return;
            }
            if (Exit.hasInterrupts(exit)) {
              return;
            }
            MutableRef.set(phase, "ended");
            on.ended();
          })
        ),
        // After the answer, the subscription stays open until the wait is interrupted.
        Effect.andThen(Effect.never),
        Effect.scoped,
        Effect.forkDetach({ startImmediately: true })
      );
      MutableRef.set(openWait, Option.some({ fiber, on, phase }));
    }),
    /**
     * Ends the subscription of an answered wait, and returns once it has ended.
     * It does nothing while the wait is still pending, or when no wait is open.
     */
    release: Effect.fn("chat.share.release")(function* () {
      const open = MutableRef.get(openWait);
      if (
        Option.isNone(open) ||
        MutableRef.get(open.value.phase) !== "answered"
      ) {
        return;
      }
      MutableRef.set(openWait, Option.none());
      yield* Fiber.interrupt(open.value.fiber);
    }),
    /**
     * Ends the open wait, and returns once it has ended. A wait that has not
     * answered calls `ended`. An answered wait ends without a callback.
     */
    dispose: Effect.fn("chat.share.dispose")(function* () {
      const open = yield* takeOpenWait;
      if (Option.isNone(open)) {
        return;
      }
      yield* Fiber.interrupt(open.value.fiber);
      if (MutableRef.get(open.value.phase) !== "pending") {
        return;
      }
      MutableRef.set(open.value.phase, "ended");
      open.value.on.ended();
    }),
  };
}
