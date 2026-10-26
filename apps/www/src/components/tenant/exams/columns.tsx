import { AddToListIcon, ListPlusIcon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import {
  CHOICE_OPTIONS_MAX,
  CHOICE_OPTIONS_MIN,
} from "@repo/backend/confect/exams/question";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "use-intl";
import {
  type OptionLabel,
  optionLetter,
} from "@/components/tenant/exams/answer";
import type { QuestionEditing } from "@/components/tenant/exams/edits";
import {
  keyPairs,
  keyWithoutPart,
  type MatchSide,
  pairsKey,
  withPartAdded,
  withPartLabel,
  withPartRemoved,
} from "@/components/tenant/exams/match";
import type { Question } from "@/components/tenant/exams/optimistic";
import { OptionRow } from "@/components/tenant/exams/option";
import {
  cellsKey,
  keyCells,
  withCellLabel,
  withStatementAdded,
  withStatementRemoved,
} from "@/components/tenant/exams/table";

/** One part of a match or a table: its ID and its rich text. */
type Part = Pick<
  Extract<Interaction, { kind: "matrix" }>["statements"][number],
  "id" | "label"
>;

/** The props of one column of parts on a question's paper. */
interface PartColumnProps {
  /**
   * The action that adds a part, with its own icon and its name, or none while the column holds the
   * most it may. Statements and answers add with icons of their own, so the two columns of a match
   * never draw the same one.
   */
  readonly add: {
    readonly icon: IconSvgElement;
    readonly label: string;
    readonly run: () => void;
  } | null;
  /** Whether the page is the chosen one, which shows the action that adds a part. */
  readonly chosen: boolean;
  /** Whether the exam is locked, so the parts take no change. */
  readonly frozen: boolean;
  /** The heading of the column. */
  readonly heading: string;
  /** The letter or number that names a part by its place. */
  readonly letterOf: (index: number) => string;
  /** The name of a part's editor and of its remove control, by the part's letter. */
  readonly namesOf: (letter: string) => {
    readonly editor: string;
    readonly remove: string;
  };
  /** Saves the label a part's editor holds. Calls `unstored` when the server does not store it. */
  readonly onLabel: (
    partId: string,
    label: OptionLabel,
    unstored: () => void
  ) => void;
  /** Removes a part, or none while the column holds the fewest it may. */
  readonly onRemove: ((partId: string) => void) | null;
  /** The parts as the page shows them, with every change the teacher made. */
  readonly parts: readonly Part[];
  /** The text an empty part's editor shows. */
  readonly placeholder: string;
  /** The parts as the server holds them, whose labels the editors start from. */
  readonly saved: readonly Part[];
}

/**
 * One column of parts on a question's paper: each part with its letter or number, its rich text, and the
 * control that removes it, then the action that adds one. The paper sets two columns side by side on a
 * wide paper and one above the other on a narrow one, as the student's paper does.
 */
function PartColumn({
  add,
  chosen,
  frozen,
  heading,
  letterOf,
  namesOf,
  onLabel,
  onRemove,
  parts,
  placeholder,
  saved,
}: PartColumnProps) {
  return (
    <div className="grid content-start gap-2">
      <p className="font-medium text-muted-foreground text-sm">{heading}</p>
      {Arr.map(parts, (part, index) => {
        const letter = letterOf(index);
        const names = namesOf(letter);
        return (
          <OptionRow
            key={part.id}
            // The editor starts from the label the server holds, or the label on screen for a new part.
            label={Option.match(
              Arr.findFirst(saved, (item) => item.id === part.id),
              { onNone: () => part.label, onSome: (item) => item.label }
            )}
            letter={letter}
            locked={frozen}
            name={names.editor}
            onRemove={onRemove === null ? null : () => onRemove(part.id)}
            onSave={(label: OptionLabel, unstored: () => void) =>
              onLabel(part.id, label, unstored)
            }
            placeholder={placeholder}
            removeName={names.remove}
          />
        );
      })}
      {add === null || frozen ? null : (
        <div className={chosen ? undefined : "invisible"}>
          <Button onClick={add.run} size="sm" type="button" variant="ghost">
            <HugeIcons aria-hidden="true" icon={add.icon} />
            {add.label}
          </Button>
        </div>
      )}
    </div>
  );
}

/** How each side of a match names its parts: statements by number, answers by letter. */
const PART_NAME = {
  sources: (index: number) => String(index + 1),
  targets: optionLetter,
} satisfies Record<MatchSide, (index: number) => string>;

/** The props of one side of a matching or a table question. */
interface SideProps {
  /** Whether the page is the chosen one, which shows the action that adds a part. */
  readonly chosen: boolean;
  readonly editing: QuestionEditing;
  /** Whether the exam is locked, so the parts take no change. */
  readonly frozen: boolean;
  /** The number of the question, which names each part for assistive technology. */
  readonly number: number;
  /** The question as the server holds it, whose labels each part's editor starts from. */
  readonly question: Question;
}

/**
 * One side of a matching question's paper: its statements, numbered, or its answers, lettered. A side
 * holds two to five parts. A part that leaves takes its pairs out of the key, and the key waits for the
 * teacher to pair every statement again (`keyWithoutPart`).
 */
export function MatchColumn({
  match,
  side,
  ...props
}: SideProps & {
  readonly match: Extract<Interaction, { kind: "match" }>;
  readonly side: MatchSide;
}) {
  const t = useTranslations("Exams");
  const parts = match[side];
  const statements = side === "sources";

  return (
    <PartColumn
      add={
        parts.length < CHOICE_OPTIONS_MAX
          ? {
              icon: statements ? ListPlusIcon : AddToListIcon,
              label: t(statements ? "statement-add" : "match-answer-add"),
              run: () =>
                props.editing.saveAnswers((draft) => {
                  const answers = withPartAdded(draft.answers, side);
                  return {
                    ...draft,
                    answers,
                    key: pairsKey(answers, keyPairs(draft.key)),
                  };
                }),
            }
          : null
      }
      chosen={props.chosen}
      frozen={props.frozen}
      heading={t(statements ? "match-statements" : "match-answers")}
      letterOf={PART_NAME[side]}
      namesOf={(name) => ({
        editor: t(statements ? "statement-of" : "answer-of", {
          name,
          number: props.number,
        }),
        remove: t(statements ? "statement-remove-of" : "answer-remove-of", {
          name,
          number: props.number,
        }),
      })}
      onLabel={(partId, label, unstored) =>
        props.editing.saveAnswers(
          (draft) => ({
            ...draft,
            answers: withPartLabel(draft.answers, partId, label),
          }),
          unstored
        )
      }
      onRemove={
        parts.length > CHOICE_OPTIONS_MIN
          ? (partId) =>
              props.editing.saveAnswers((draft) => {
                const answers = withPartRemoved(draft.answers, partId);
                return {
                  ...draft,
                  answers,
                  key: keyWithoutPart(answers, draft.key, partId),
                };
              })
          : null
      }
      parts={parts}
      placeholder={t(
        statements ? "statement-placeholder" : "answer-placeholder"
      )}
      saved={Arr.flatMap(props.question.answers, (answer) =>
        answer.kind === "match" ? answer[side] : []
      )}
    />
  );
}

/**
 * One side of a true or false table's paper: its statements, numbered, which the teacher adds and
 * removes from two to five, or its two columns, lettered, which the teacher may retype in the question's
 * language. A statement that leaves takes its mark out of the key, and the key waits for the teacher to
 * mark every statement again.
 */
export function TableColumn({
  side,
  table,
  ...props
}: SideProps & {
  readonly side: "columns" | "statements";
  readonly table: Extract<Interaction, { kind: "matrix" }>;
}) {
  const t = useTranslations("Exams");
  const statements = side === "statements";
  const parts = table[side];

  return (
    <PartColumn
      add={
        statements && parts.length < CHOICE_OPTIONS_MAX
          ? {
              icon: ListPlusIcon,
              label: t("statement-add"),
              run: () =>
                props.editing.saveAnswers((draft) => {
                  const answers = withStatementAdded(draft.answers);
                  return {
                    ...draft,
                    answers,
                    key: cellsKey(answers, keyCells(draft.key)),
                  };
                }),
            }
          : null
      }
      chosen={props.chosen}
      frozen={props.frozen}
      heading={t(statements ? "match-statements" : "table-columns")}
      letterOf={statements ? (index) => String(index + 1) : optionLetter}
      namesOf={(name) => ({
        editor: t(statements ? "statement-of" : "column-of", {
          name,
          number: props.number,
        }),
        remove: t("statement-remove-of", { name, number: props.number }),
      })}
      onLabel={(partId, label, unstored) =>
        props.editing.saveAnswers(
          (draft) => ({
            ...draft,
            answers: withCellLabel(draft.answers, partId, label),
          }),
          unstored
        )
      }
      onRemove={
        statements && parts.length > CHOICE_OPTIONS_MIN
          ? (partId) =>
              props.editing.saveAnswers((draft) => {
                const answers = withStatementRemoved(draft.answers, partId);
                return {
                  ...draft,
                  answers,
                  key: cellsKey(
                    answers,
                    Arr.filter(
                      keyCells(draft.key),
                      (cell) => cell.statement !== partId
                    )
                  ),
                };
              })
          : null
      }
      parts={parts}
      placeholder={t(
        statements ? "statement-placeholder" : "column-placeholder"
      )}
      saved={Arr.flatMap(props.question.answers, (answer) =>
        answer.kind === "matrix" ? answer[side] : []
      )}
    />
  );
}
