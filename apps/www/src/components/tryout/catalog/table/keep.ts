import { Array as Arr, Option, Record as Rec } from "effect";
import { holdsText, inRange } from "@/components/shared/table/filter";
import type { TryoutSetRow } from "@/components/tryout/catalog/table/types";

/** The seconds of one minute, the unit the duration column prints and filters by. */
const SECONDS_IN_MINUTE = 60;

/** Whether a cell passes what the page's filters hold for its column, which keeps every row while it holds nothing. */
const keeps = (
  chosen: Readonly<Record<string, readonly string[]>>,
  column: string,
  value: number | string | null,
  passes: (value: unknown, chosen: unknown) => boolean
) =>
  Option.match(
    Option.filter(Rec.get(chosen, column), Arr.isReadonlyArrayNonEmpty),
    { onNone: () => true, onSome: (values) => passes(value, values) }
  );

/** The rows of a track that its heads keep: the words of a name, and a range of questions, minutes and score. */
export const keptSets = (
  rows: readonly TryoutSetRow[],
  chosen: Readonly<Record<string, readonly string[]>>
) =>
  Arr.filter(
    rows,
    (row) =>
      keeps(chosen, "title", row.title, holdsText) &&
      keeps(chosen, "questionCount", row.questionCount, inRange) &&
      keeps(
        chosen,
        "durationSeconds",
        row.durationSeconds / SECONDS_IN_MINUTE,
        inRange
      ) &&
      keeps(chosen, "publishedScore", row.publishedScore, inRange)
  );
