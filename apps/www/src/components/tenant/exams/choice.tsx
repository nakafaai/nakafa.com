import { ListPlusIcon } from "@hugeicons/core-free-icons";
import { partDirection, partLetter } from "@repo/backend/confect/exams/letters";
import {
  CHOICE_OPTIONS_MAX,
  CHOICE_OPTIONS_MIN,
  fixedOptions,
} from "@repo/backend/confect/exams/question";
import { REASON_ID } from "@repo/backend/confect/exams/scoring";
import { LineWords } from "@repo/design-system/components/ui/line";
import { randomUuid } from "@repo/utilities/uuid";
import { Array as Arr, Effect, Option } from "effect";
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
import { OptionRemove, OptionRow } from "@/components/tenant/exams/option";
import { useQuestionPage } from "@/components/tenant/exams/page";
import { choiceTitle } from "@/components/tenant/exams/reason";
import { ExamDocument } from "@/components/tenant/exams/rich";
import {
  PaperOption,
  PaperOptions,
  PartAdd,
} from "@/components/tenant/exams/sheet";
import type { Unstored } from "@/components/tenant/exams/writer";

/**
 * One choice of a question on its paper, as the student meets it: its options, each written on its marked line with
 * its remove control while it may go, and the action that adds one. A reason stands under its name in the paper, as
 * the student reads it. A template that fixes its options keeps their number, so the teacher neither adds nor removes
 * one.
 */
export function ChoiceSheet({ choice }: { readonly choice: Choice }) {
  const t = useTranslations("Exams");
  const { chosen, editing, locked, number, question } = useQuestionPage();
  const { displayed, saveAnswers } = editing;
  const reason = choice.id === REASON_ID;
  const fixed = Option.isSome(fixedOptions(displayed.template));
  const removable = choice.options.length > CHOICE_OPTIONS_MIN && !fixed;
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
        <PaperOptions dir={partDirection(choice.options)}>
          {Arr.map(choice.options, (option, index) => {
            const letter = partLetter(choice.options, index);

            return (
              <OptionRow
                key={option.id}
                label={savedLabel(option)}
                onSave={(label: OptionLabel, unstored: Unstored) =>
                  saveAnswers(
                    (draft) => ({
                      ...draft,
                      answers: withOptionLabel(draft.answers, option.id, label),
                    }),
                    unstored
                  )
                }
              >
                <PaperOption letter={letter} multiple={choice.maxChoices !== 1}>
                  <LineWords>
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
                  </LineWords>
                  {removable ? (
                    <OptionRemove
                      name={t("option-remove-of", { letter, number })}
                      onRemove={() =>
                        saveAnswers((draft) => ({
                          ...draft,
                          answers: withOptionRemoved(draft.answers, option.id),
                          key: keyWithoutOption(draft.key, option.id),
                        }))
                      }
                    />
                  ) : null}
                </PaperOption>
              </OptionRow>
            );
          })}
        </PaperOptions>
      </ChoiceGroup>
      {choice.options.length < CHOICE_OPTIONS_MAX && !fixed && !locked ? (
        <PartAdd
          icon={ListPlusIcon}
          label={t(reason ? "reason-add" : "option-add")}
          onAdd={() => {
            const unique = Effect.runSync(randomUuid);
            saveAnswers((draft) => ({
              ...draft,
              answers: withOptionAdded(draft.answers, choice.id, unique),
            }));
          }}
          shown={chosen}
        />
      ) : null}
    </>
  );
}
