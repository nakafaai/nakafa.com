import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

type CurrentAttempt = FunctionReturnType<
  typeof api.tryouts.queries.attempt.getCurrent
>;
type TryoutStatus = NonNullable<CurrentAttempt>["status"];

interface TryoutAttemptClock {
  expiresAt: number;
  status: TryoutStatus;
}

interface TryoutRuntimeClock {
  expiresAt: number;
  section: {
    status: TryoutStatus;
  };
}

/** Render state for a Convex section runtime around its local timer boundary. */
export type TryoutRuntimeState<Runtime> =
  | { kind: "none" }
  | { kind: "active"; runtime: Runtime }
  | { kind: "pending"; runtime: Runtime }
  | { kind: "review"; runtime: Runtime };

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
