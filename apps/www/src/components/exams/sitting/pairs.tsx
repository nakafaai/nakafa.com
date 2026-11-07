import { optionLetters } from "@repo/backend/confect/exams/letters";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import {
  LinesColumn,
  LinesItem,
  LinesProvider,
} from "@/components/exams/lines/board";
import { SittingDocument } from "@/components/exams/sitting/document";
import { usePaperLocked } from "@/components/exams/sitting/lock";
import type { MatchPart } from "@/components/exams/sitting/response";

/**
 * A matching question as a paper sets it: the statements in one column, each numbered, the answers in the other,
 * each named by its letter, and a line from each statement to the answer the student joins it to, drawn by a
 * drag, two presses, or the keyboard. Joining an answer another statement holds moves its line here, since each
 * answer pairs one statement, and a line taken away leaves its statement open again.
 */
export function SittingPairs({
  labelledBy,
  match,
  onPair,
  pairs,
}: {
  /** The id of the heading that names the question. */
  readonly labelledBy: string;
  readonly match: MatchPart;
  /** Saves the pairs each time the student draws, moves, or takes away a line. */
  readonly onPair: (
    pairs: readonly { readonly source: string; readonly target: string }[]
  ) => void;
  /** The pairs the paper holds for the question. */
  readonly pairs: readonly {
    readonly source: string;
    readonly target: string;
  }[];
}) {
  const disabled = usePaperLocked();
  const t = useTranslations("Exams");
  // The answers are named in the script of their labels, as the teacher's paper names them: أ, ب, ج for answers
  // written in Arabic.
  const letterOf = optionLetters(Arr.map(match.targets, (part) => part.label));

  return (
    <fieldset aria-labelledby={labelledBy} className="grid min-w-0 gap-3">
      <LinesProvider
        disabled={disabled}
        match={match}
        onPairs={onPair}
        pairs={pairs}
        size="paper"
        stretch
      >
        <LinesColumn side="sources">
          {Arr.map(match.sources, (source, index) => (
            <LinesItem
              id={source.id}
              key={source.id}
              name={String(index + 1)}
              side="sources"
            >
              <SittingDocument document={source.label} size="line" />
            </LinesItem>
          ))}
        </LinesColumn>
        <LinesColumn side="targets">
          {Arr.map(match.targets, (target, index) => (
            <LinesItem
              id={target.id}
              key={target.id}
              name={letterOf(index)}
              side="targets"
            >
              <SittingDocument document={target.label} size="line" />
            </LinesItem>
          ))}
        </LinesColumn>
      </LinesProvider>
      {disabled ? null : (
        <p className="text-muted-foreground text-sm">{t("pair-hint")}</p>
      )}
    </fieldset>
  );
}
