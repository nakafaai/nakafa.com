import {
  LineMark,
  LineWords,
  MarkedLine,
} from "@repo/design-system/components/ui/line";
import { Array as Arr } from "effect";

const rows = [
  { letter: "A", tone: "idle", words: "The parabola opens downward." },
  { letter: "B", tone: "chosen", words: "Its vertex is at (2, −1)." },
  { letter: "C", tone: "correct", words: "Its axis of symmetry is x = 2." },
  { letter: "D", tone: "wrong", words: "It has no real roots." },
  { letter: "E", tone: "key", words: "It crosses the y-axis at 3." },
] as const;

export const card = {
  name: "MarkedLine",
  group: "Forms",
  height: 400,
  source: "components/ui/line",
};

/** The answer rows of a question in every tone: open, chosen, correct, wrong, and the key a learner did not mark. */
export function Preview() {
  return (
    <div className="flex max-w-md flex-col gap-2 p-6">
      {Arr.map(rows, (row) => (
        <MarkedLine key={row.letter} tone={row.tone}>
          <LineMark letter>{row.letter}</LineMark>
          <LineWords>{row.words}</LineWords>
        </MarkedLine>
      ))}
    </div>
  );
}
