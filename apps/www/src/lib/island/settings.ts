import { Effect } from "effect";

/** Where the browser keeps the learner's sound switch for the island (ADR 0047, D8). */
const MUTED_KEY = "nakafa:island:muted";

/** Whether the learner turned the island's sound off, read from this browser; on when it cannot be read. */
export function readMuted() {
  return Effect.runSync(
    Effect.try(() => localStorage.getItem(MUTED_KEY) === "true").pipe(
      Effect.orElseSucceed(() => false)
    )
  );
}

/** Keeps the learner's sound switch in this browser; a browser that refuses storage just forgets it. */
export function writeMuted(muted: boolean) {
  Effect.runSync(
    Effect.try(() => localStorage.setItem(MUTED_KEY, String(muted))).pipe(
      Effect.ignore
    )
  );
}
