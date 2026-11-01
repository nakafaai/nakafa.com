import { ListPlusIcon } from "@hugeicons/core-free-icons";
import {
  letterScript,
  optionLetter,
} from "@repo/backend/confect/exams/letters";
import {
  CHOICE_OPTIONS_MAX,
  CHOICE_OPTIONS_MIN,
  fixedOptions,
} from "@repo/backend/confect/exams/question";
import { REASON_ID } from "@repo/backend/confect/exams/scoring";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "use-intl";
import { ChoiceGroup } from "@/components/exams/sitting/reason";
import {
  type Choice,
  keyWithoutOption,
  type OptionLabel,
  withOptionAdded,
  withOptionLabel,
  withOptionRemoved,
} from "@/components/tenant/exams/answer";
import type { QuestionEditing } from "@/components/tenant/exams/edits";
import type { Question } from "@/components/tenant/exams/optimistic";
import { OptionRow } from "@/components/tenant/exams/option";
import { useExamLocked } from "@/components/tenant/exams/provider";
import { choiceTitle } from "@/components/tenant/exams/reason";
import { ExamDocument } from "@/components/tenant/exams/rich";
import { PaperOption, PaperOptions } from "@/components/tenant/exams/sheet";
import type { Unstored } from "@/components/tenant/exams/writer";

/**
 * One choice of a question on its paper, as the student meets it: its options, each written in its row, and the
 * action that adds one. A reason stands under its name in the paper, as the student reads it. A template that
 * fixes its options keeps their number, so the teacher neither adds nor removes one.
 */
export function ChoiceSheet({
  choice,
  chosen,
  editing,
  number,
  question,
}: {
  readonly choice: Choice;
  /** Whether the page is the chosen one, which shows the action that adds an option. */
  readonly chosen: boolean;
  readonly editing: QuestionEditing;
  /** The place of the question in the exam, which names its options for assistive technology. */
  readonly number: number;
  /** The question as the server holds it, whose labels each option's editor starts from. */
  readonly question: Question;
}) {
  const t = useTranslations("Exams");
  const locked = useExamLocked();
  const { displayed, saveAnswers } = editing;
  const reason = choice.id === REASON_ID;
  // The options are named in the script of their labels: أ, ب, ج for a set written in Arabic.
  const script = letterScript(
    Arr.map(choice.options, (option) => option.label)
  );
  const fixed = Option.isSome(fixedOptions(displayed.template));
  const canAdd =
    choice.options.length < CHOICE_OPTIONS_MAX && !fixed && !locked;
  // The label the server holds for an option. Its editor starts from that label, and a label the server does not
  // store goes back to it, so the editor never keeps text that is not saved. An option the server does not hold
  // yet has the label the paper shows.
  const savedLabel = (option: Choice["options"][number]): OptionLabel =>
    Option.match(
      Arr.findFirst(
        Arr.flatMap(question.answers, (saved) =>
          saved.kind === "choice" ? saved.options : []
        ),
        (item) => item.id === option.id
      ),
      {
        onNone: () => option.label,
        onSome: (item) => item.label,
      }
    );

  return (
    <>
      <ChoiceGroup title={choiceTitle(displayed.template, choice.id)}>
        <PaperOptions>
          {Arr.map(choice.options, (option, index) => {
            const letter = optionLetter(index, script);

            return (
              <OptionRow
                key={option.id}
                label={savedLabel(option)}
                locked={locked}
                onRemove={
                  choice.options.length > CHOICE_OPTIONS_MIN && !fixed
                    ? () =>
                        saveAnswers((draft) => ({
                          ...draft,
                          answers: withOptionRemoved(draft.answers, option.id),
                          key: keyWithoutOption(draft.key, option.id),
                        }))
                    : null
                }
                onSave={(label: OptionLabel, unstored: Unstored) =>
                  saveAnswers(
                    (draft) => ({
                      ...draft,
                      answers: withOptionLabel(draft.answers, option.id, label),
                    }),
                    unstored
                  )
                }
                removeName={t("option-remove-of", { letter, number })}
              >
                <PaperOption multiple={choice.maxChoices !== 1}>
                  <ExamDocument
                    label={t(reason ? "reason-of" : "option-of", {
                      letter,
                      number,
                    })}
                    placeholder={t(
                      reason ? "reason-placeholder" : "option-placeholder"
                    )}
                    size="line"
                  />
                </PaperOption>
              </OptionRow>
            );
          })}
        </PaperOptions>
      </ChoiceGroup>
      {canAdd ? (
        <div className={chosen ? undefined : "invisible"}>
          <Button
            onClick={() =>
              saveAnswers((draft) => ({
                ...draft,
                answers: withOptionAdded(draft.answers, choice.id),
              }))
            }
            size="sm"
            type="button"
            variant="outline"
          >
            <HugeIcons aria-hidden="true" icon={ListPlusIcon} />
            {t(reason ? "reason-add" : "option-add")}
          </Button>
        </div>
      ) : null}
    </>
  );
}
