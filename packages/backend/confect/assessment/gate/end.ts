import { Schema } from "effect";

/** Why an attempt or section left its in-progress state, as stored. */
export const EndReason = Schema.Literals(["submitted", "time-expired"]);
export type EndReason = typeof EndReason.Type;

/** The terminal status stored beside an end reason. */
const FinishedStatus = Schema.Literals(["completed", "expired"]);
type FinishedStatus = typeof FinishedStatus.Type;

const statuses = {
  submitted: "completed",
  "time-expired": "expired",
} satisfies Record<EndReason, FinishedStatus>;

/** Returns the terminal status stored for one end reason. */
export function statusOf(reason: EndReason): FinishedStatus {
  return statuses[reason];
}
