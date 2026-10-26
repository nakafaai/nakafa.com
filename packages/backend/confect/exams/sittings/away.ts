import type { examSignalValidator } from "@repo/backend/confect/exams/sittings/schema";
import { Array as Arr, Option } from "effect";

/** One integrity signal as the time away reads it: when it was recorded, and its kind. */
type Signal = Pick<typeof examSignalValidator.Type, "at" | "kind">;

/**
 * How long a student stayed away after one exit (K25): until the first return after it, in whole
 * seconds, or none while the student has not come back. Outside the exam, a proctor and a teacher see
 * only that the student left and for how long, never what the student did there.
 */
export function awayFor(
  signals: readonly Signal[],
  exit: { readonly at: number }
): Option.Option<number> {
  return Option.map(
    Arr.reduce(signals, Option.none<number>(), (first, signal) =>
      signal.kind === "return" &&
      signal.at >= exit.at &&
      Option.getOrElse(
        Option.map(first, (at) => signal.at < at),
        () => true
      )
        ? Option.some(signal.at)
        : first
    ),
    (back) => Math.round((back - exit.at) / 1000)
  );
}

/**
 * The integrity indication of one attempt after its exam (K25): how many times the student left the
 * exam, and the seconds away in all, counting each exit until the return after it. It is only an
 * indication for the teacher, never a verdict, and an exit with no return counts no time.
 */
export const integrityOf = (signals: readonly Signal[]) => {
  const exits = Arr.filter(signals, (signal) => signal.kind === "exit");
  return {
    awaySeconds: Arr.reduce(exits, 0, (total, exit) =>
      Option.match(awayFor(signals, exit), {
        onNone: () => total,
        onSome: (seconds) => total + seconds,
      })
    ),
    exits: exits.length,
  };
};
