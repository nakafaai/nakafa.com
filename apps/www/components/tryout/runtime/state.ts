import {
  tryoutAttemptStateValidator,
  tryoutCurrentSectionValidator,
  tryoutSectionRuntimeValidator,
} from "@repo/backend/confect/tryouts/runtime/spec";
import { Schema, Struct } from "effect";

/** Attempt fields that decide whether a timer-bound attempt is still active. */
const TryoutAttemptClockSchema = tryoutAttemptStateValidator.mapFields(
  Struct.pick(["expiresAt", "status"])
);
type TryoutAttemptClock = typeof TryoutAttemptClockSchema.Type;

/** Section runtime fields that decide whether its timer has reached its end. */
const TryoutRuntimeClockSchema = Schema.Struct({
  ...tryoutSectionRuntimeValidator.mapFields(Struct.pick(["expiresAt"])).fields,
  section: tryoutCurrentSectionValidator.mapFields(Struct.pick(["status"])),
});
type TryoutRuntimeClock = typeof TryoutRuntimeClockSchema.Type;

/** Attempt status that decides whether the section state still mutates. */
const TryoutReactiveStateSchema = Schema.Struct({
  attempt: tryoutAttemptStateValidator.mapFields(Struct.pick(["status"])),
});
type TryoutReactiveState = typeof TryoutReactiveStateSchema.Type;

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
}) {
  if (!runtime) {
    return { kind: "none" } as const;
  }

  if (runtime.section.status !== "in-progress") {
    return { kind: "review", runtime } as const;
  }

  if (!activeAttempt || now >= runtime.expiresAt) {
    return { kind: "pending", runtime } as const;
  }

  return { kind: "active", runtime } as const;
}

/** Render state for a Convex section runtime around its local timer boundary. */
export type TryoutRuntimeState<Runtime extends TryoutRuntimeClock> = ReturnType<
  typeof getTryoutRuntimeState<Runtime>
>;
