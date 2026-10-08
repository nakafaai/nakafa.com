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

/** Render state for a Convex section runtime around its local timer boundary. */
export type TryoutRuntimeState<Runtime> =
  | { kind: "none" }
  | { kind: "active"; runtime: Runtime }
  | { kind: "pending"; runtime: Runtime }
  | { kind: "review"; runtime: Runtime };

/** Subscribes only while one exact attempt can still mutate. */
export function isTryoutStateLive(state: TryoutReactiveState | null) {
  return state?.attempt.status === "in-progress";
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
