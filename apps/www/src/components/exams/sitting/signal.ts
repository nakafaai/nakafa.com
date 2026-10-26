import type { SignalKind } from "@repo/backend/confect/exams/sittings/schema";
import { HashMap, Option } from "effect";

/** The kinds of signal that a student's screen can send. */
type Kind = typeof SignalKind.Type;

/** The least time between two signals of one kind, in milliseconds, so one kind sends at most once a second. */
export const SIGNAL_INTERVAL_MS = 1000;

/** The time each kind was last sent, and whether the next signal of a kind may be sent now. */
export type SignalGate = HashMap.HashMap<Kind, number>;

/**
 * Checks one signal against the gate. It returns whether the signal may be sent, and the gate
 * after the check. A kind that was sent less than a second ago is dropped, and a kind that was
 * not is sent and recorded at this time.
 */
export function takeSignal(
  gate: SignalGate,
  kind: Kind,
  now: number
): readonly [send: boolean, gate: SignalGate] {
  const last = HashMap.get(gate, kind);
  if (Option.isSome(last) && now - last.value < SIGNAL_INTERVAL_MS) {
    return [false, gate];
  }
  return [true, HashMap.set(gate, kind, now)];
}

/** The signal of a change of page visibility: leaving when the page is hidden, and returning when it shows. */
export function visibilitySignal(
  state: DocumentVisibilityState
): Extract<Kind, "exit" | "return"> {
  if (state === "hidden") {
    return "exit";
  }
  return "return";
}

/** Whether the page left full screen since the last check, which the student is asked to undo. */
export function leftFullscreen(wasFullscreen: boolean, isFullscreen: boolean) {
  return wasFullscreen && !isFullscreen;
}
