import { AddToListIcon, ListPlusIcon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import { partLetter } from "@repo/backend/confect/exams/letters";
import {
  CHOICE_OPTIONS_MAX,
  CHOICE_OPTIONS_MIN,
} from "@repo/backend/confect/exams/question";
import { LineWords } from "@repo/design-system/components/ui/line";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "use-intl";
import { LinesColumn, LinesItem } from "@/components/exams/lines/board";
import type { OptionLabel } from "@/components/tenant/exams/answer";
import { type MatchSide, withPartLabel } from "@/components/tenant/exams/match";
import { OptionRemove, OptionRow } from "@/components/tenant/exams/option";
import { useQuestionPage } from "@/components/tenant/exams/page";
import { ExamDocument } from "@/components/tenant/exams/rich";
import { PartAdd } from "@/components/tenant/exams/sheet";
import type { Unstored } from "@/components/tenant/exams/writer";

/** One part of a match or a table: its ID and its rich text. */
type Part = Pick<
  Extract<Interaction, { kind: "matrix" }>["statements"][number],
  "id" | "label"
>;

/** What a column of parts holds: statements, numbered, or answers, lettered. */
type PartKind = "answers" | "statements";

/**
 * The words of each kind of column: the name of a part's editor and of its remove control for assistive
 * technology, and the hint an empty part shows.
 */
const PART_WORDS = {
  answers: {
    editor: "answer-of",
    placeholder: "answer-placeholder",
    remove: "answer-remove-of",
  },
  statements: {
    editor: "statement-of",
    placeholder: "statement-placeholder",
    remove: "statement-remove-of",
  },
} as const;

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
  /** What the column holds, which names its parts. */
  readonly kind: PartKind;
  /** Saves the label a part's editor holds. Calls `unstored` when the server does not store it. */
  readonly onLabel: (
    partId: string,
    label: OptionLabel,
    unstored: Unstored
  ) => void;
  /** Removes a part; absent while the column holds the fewest it may. */
  readonly onRemove?: (partId: string) => void;
  /** The parts as the page shows them, with every change the teacher made. */
  readonly parts: readonly Part[];
  /** The parts as the server holds them, whose labels the editors start from. */
  readonly saved: readonly Part[];
}

/**
 * One column of parts on a question's paper, as the student's paper sets it: each part on its outlined row with its
 * letter or number, its rich text, the teacher's control that removes it, and the dot its line starts or ends at
 * outside the row. The action below adds one.
 */
function PartColumn({
  add,
  kind,
  onLabel,
  onRemove,
  parts,
  saved,
}: PartColumnProps) {
  const t = useTranslations("Exams");
  const { chosen, locked, number } = useQuestionPage();
  const words = PART_WORDS[kind];

  return (
    <LinesColumn
      footer={
        add === null || locked ? null : (
          <PartAdd
            icon={add.icon}
            label={add.label}
            onAdd={add.run}
            shown={chosen}
          />
        )
      }
      side={kind === "statements" ? "sources" : "targets"}
    >
      {Arr.map(parts, (part, index) => {
        const name =
          kind === "statements" ? String(index + 1) : partLetter(parts, index);
        return (
          <LinesItem
            id={part.id}
            key={part.id}
            name={name}
            side={kind === "statements" ? "sources" : "targets"}
          >
            <OptionRow
              // The editor starts from the label the server holds, or the label on screen for a new part.
              label={Option.match(
                Arr.findFirst(saved, (item) => item.id === part.id),
                { onNone: () => part.label, onSome: (item) => item.label }
              )}
              onSave={(label: OptionLabel, unstored: Unstored) =>
                onLabel(part.id, label, unstored)
              }
            >
              <LineWords>
                <ExamDocument
                  label={t(words.editor, { name, number })}
                  placeholder={t(words.placeholder)}
                  size="line"
                />
              </LineWords>
              {onRemove === undefined ? null : (
                <OptionRemove
                  name={t(words.remove, { name, number })}
                  onRemove={() => onRemove(part.id)}
                />
              )}
            </OptionRow>
          </LinesItem>
        );
      })}
    </LinesColumn>
  );
}

/**
 * One side of a matching question's paper: its statements, numbered, or its answers, lettered. A side holds two to
 * five parts. A part that leaves takes its line with it, and the other lines wait for every statement to be paired.
 */
export function MatchColumn({
  match,
  side,
}: {
  readonly match: Extract<Interaction, { kind: "match" }>;
  readonly side: MatchSide;
}) {
  const t = useTranslations("Exams");
  const { editing, question } = useQuestionPage();
  const parts = match[side];
  const statements = side === "sources";

  return (
    <PartColumn
      add={
        parts.length < CHOICE_OPTIONS_MAX
          ? {
              icon: statements ? ListPlusIcon : AddToListIcon,
              label: t(statements ? "statement-add" : "match-answer-add"),
              run: () => editing.addPart(side),
            }
          : null
      }
      kind={statements ? "statements" : "answers"}
      onLabel={(partId, label, unstored) =>
        editing.saveAnswers(
          (draft) => ({
            ...draft,
            answers: withPartLabel(draft.answers, partId, label),
          }),
          unstored
        )
      }
      {...(parts.length > CHOICE_OPTIONS_MIN
        ? { onRemove: editing.removePart }
        : {})}
      parts={parts}
      saved={Arr.flatMap(question.answers, (answer) =>
        answer.kind === "match" ? answer[side] : []
      )}
    />
  );
}
