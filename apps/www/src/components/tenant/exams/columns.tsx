import { Add01Icon } from "@hugeicons/core-free-icons";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import {
  CHOICE_OPTIONS_MAX,
  CHOICE_OPTIONS_MIN,
} from "@repo/backend/confect/exams/question";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "use-intl";
import { type OptionLabel, optionLetter } from "@/components/tenant/exams/answer";
import type { QuestionEditing } from "@/components/tenant/exams/edits";
import {
  keyPairs,
  keyWithoutPart,
  type MatchSide,
  matchOf,
  pairsKey,
  withPartAdded,
  withPartLabel,
  withPartRemoved,
} from "@/components/tenant/exams/match";
import type { Question } from "@/components/tenant/exams/optimistic";
import { OptionRow } from "@/components/tenant/exams/option";

/** The match interaction, which a matching question holds. */
type Match = Extract<Interaction, { kind: "match" }>;

/** How each side of a match names its parts: statements by number, answers by letter. */
const PART_NAME = {
  sources: (index: number) => String(index + 1),
  targets: optionLetter,
} satisfies Record<MatchSide, (index: number) => string>;

/** The props of one side of a matching question's paper. */
interface MatchColumnProps {
  /** Whether the page is the chosen one, which shows the action that adds a part. */
  readonly chosen: boolean;
  readonly editing: QuestionEditing;
  /** Whether the exam is locked, so the parts take no change. */
  readonly frozen: boolean;
  /** The match as the page shows it, with every change the teacher made. */
  readonly match: Match;
  /** The number of the question, which names each part for assistive technology. */
  readonly number: number;
  /** The question as the server holds it, whose labels each part's editor starts from. */
  readonly question: Question;
  readonly side: MatchSide;
}

/**
 * One side of a matching question's paper: its statements, numbered, or its answers, lettered, each with
 * its rich text and the control that removes it, then the action that adds one. The paper sets the two
 * sides side by side on a wide paper and one above the other on a narrow one, as the student's paper does. A side holds two to five parts. A
 * part that leaves takes its pairs out of the key, and the key waits for the teacher to pair every
 * statement again (`keyWithoutPart`).
 */
export function MatchColumn({
  chosen,
  editing,
  frozen,
  match,
  number,
  question,
  side,
}: MatchColumnProps) {
  const t = useTranslations("Exams");
  const parts = match[side];
  // The label the server holds for a part, which its editor starts from, or the label on screen for a part the
  // server does not hold yet.
  const savedLabel = (part: {
    readonly id: string;
    readonly label: OptionLabel;
  }): OptionLabel =>
    Option.match(
      Option.flatMap(matchOf(question.answers), (saved) =>
        Arr.findFirst(
          Arr.appendAll(saved.sources, saved.targets),
          (item) => item.id === part.id
        )
      ),
      { onNone: () => part.label, onSome: (item) => item.label }
    );

  return (
    <div className="grid content-start gap-2">
      <p className="font-medium text-muted-foreground text-sm">
        {t(side === "sources" ? "match-statements" : "match-answers")}
      </p>
      {Arr.map(parts, (part, index) => {
        const name = PART_NAME[side](index);
        return (
          <OptionRow
            key={part.id}
            label={savedLabel(part)}
            letter={name}
            locked={frozen}
            name={t(side === "sources" ? "statement-of" : "answer-of", {
              name,
              number,
            })}
            onRemove={
              parts.length > CHOICE_OPTIONS_MIN
                ? () =>
                    editing.saveAnswers((draft) => {
                      const answers = withPartRemoved(draft.answers, part.id);
                      return {
                        ...draft,
                        answers,
                        key: keyWithoutPart(answers, draft.key, part.id),
                      };
                    })
                : null
            }
            onSave={(label: OptionLabel, unstored: () => void) =>
              editing.saveAnswers(
                (draft) => ({
                  ...draft,
                  answers: withPartLabel(draft.answers, part.id, label),
                }),
                unstored
              )
            }
            placeholder={t(
              side === "sources" ? "statement-placeholder" : "answer-placeholder"
            )}
            removeName={t(
              side === "sources" ? "statement-remove-of" : "answer-remove-of",
              { name, number }
            )}
          />
        );
      })}
      {parts.length < CHOICE_OPTIONS_MAX && !frozen ? (
        <div className={chosen ? undefined : "invisible"}>
          <Button
            onClick={() =>
              editing.saveAnswers((draft) => {
                const answers = withPartAdded(draft.answers, side);
                return {
                  ...draft,
                  answers,
                  key: pairsKey(answers, keyPairs(draft.key)),
                };
              })
            }
            size="sm"
            type="button"
            variant="ghost"
          >
            <HugeIcons aria-hidden="true" icon={Add01Icon} />
            {t(side === "sources" ? "statement-add" : "match-answer-add")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
