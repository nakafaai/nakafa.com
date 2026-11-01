import type { tryoutAttemptStateValidator } from "@repo/backend/confect/tryouts/runtime/spec";
import { tryoutStatusValidator } from "@repo/backend/confect/tryouts/status";
import { Schema } from "effect";

type TryoutAttemptClock = Pick<
  typeof tryoutAttemptStateValidator.Type,
  "expiresAt" | "status"
>;

const TryoutRuntimeClockSchema = Schema.Struct({
  expiresAt: Schema.Finite,
  section: Schema.Struct({
    status: tryoutStatusValidator,
  }),
});

type TryoutRuntimeClock = typeof TryoutRuntimeClockSchema.Type;

const TryoutReactiveStateSchema = Schema.Struct({
  attempt: Schema.Struct({
    status: tryoutStatusValidator,
  }),
});

type TryoutReactiveState = typeof TryoutReactiveStateSchema.Type;

const TryoutQuestionStateSchema = Schema.Struct({
  ...TryoutReactiveStateSchema.fields,
  runtime: Schema.Unknown,
});

type TryoutQuestionState = typeof TryoutQuestionStateSchema.Type;

/** Render state for a Convex section runtime around its local timer boundary. */
export type TryoutRuntimeState<Runtime> =
  | { kind: "none" }
  | { kind: "active"; runtime: Runtime }
  | { kind: "pending"; runtime: Runtime }
  | { kind: "review"; runtime: Runtime };

/** A runtime the learner is still working in, before or past its local deadline. */
export function isTryoutRuntimeRunning<Runtime>(
  state: TryoutRuntimeState<Runtime>
): state is Extract<
  TryoutRuntimeState<Runtime>,
  { kind: "active" | "pending" }
> {
  return state.kind === "active" || state.kind === "pending";
}

/** Subscribes only while one exact attempt can still mutate. */
export function isTryoutStateLive(state: TryoutReactiveState | null) {
  return state?.attempt.status === "in-progress";
}

/**
 * Whether a state holds a running attempt's questions. From then on an answer changes nothing the page's
 * own read carries: the live state repeats alone, until it stops holding them.
 */
export function holdsTryoutQuestions(state: TryoutQuestionState | null) {
  return state !== null && state.runtime !== null && isTryoutStateLive(state);
}

/** Returns an in-progress attempt only before its overall deadline. */
export function getActiveTryoutAttempt<Attempt extends TryoutAttemptClock>(
  attempt: Attempt | null,
  now: number
): Attempt | null {
  if (attempt?.status !== "in-progress") {
    return null;
  }

  if (now >= attempt.expiresAt) {
    return null;
  }

  return attempt;
}

/**
 * The attempt a page's action reads. While the learner read is pending there is none yet, so the
 * action shows its loader and takes no press; an attempt whose time ran out here reads as none, so
 * the action starts again; any other attempt is the page's own.
 */
export function selectActionAttempt<Attempt extends TryoutAttemptClock>(input: {
  readonly activeAttempt: Attempt | null;
  readonly currentAttempt: Attempt | null;
  readonly pending: boolean;
}): Attempt | null | undefined {
  if (input.pending) {
    return undefined;
  }
  if (
    input.currentAttempt?.status === "in-progress" &&
    input.activeAttempt === null
  ) {
    return null;
  }
  return input.currentAttempt;
}

/** Keeps an expired runtime visible until Convex publishes its terminal state. */
export function getTryoutRuntimeState<Runtime extends TryoutRuntimeClock>({
  activeAttempt,
  now,
  runtime,
}: {
  activeAttempt: TryoutAttemptClock | null;
  now: number;
  runtime: Runtime | null;
}): TryoutRuntimeState<Runtime> {
  if (!runtime) {
    return { kind: "none" };
  }

  if (runtime.section.status !== "in-progress") {
    return { kind: "review", runtime };
  }

  if (!activeAttempt || now >= runtime.expiresAt) {
    return { kind: "pending", runtime };
  }

  return { kind: "active", runtime };
}
