"use client";

import { useMutation } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Radio,
  RadioGroup,
} from "@repo/design-system/components/ui/radio-group";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "next-intl";
import {
  choiceOf,
  labelText,
  markedKey,
  markedOption,
  optionLetter,
  withOptionText,
} from "@/components/tenant/exams/answer";
import {
  answerUpdate,
  type Question,
} from "@/components/tenant/exams/optimistic";
import { useActiveQuestion, useExam } from "@/components/tenant/exams/provider";

/**
 * The canvas of the selected question: its number, then its options, each a text field
 * with a radio that marks the correct answer. Every change saves the question's answers
 * or key at the revision the teacher saw, so an edit that another edit overtook is refused.
 */
export function ExamCanvas() {
  const t = useTranslations("Exams");
  const active = useActiveQuestion();

  return Option.match(active, {
    onNone: () => null,
    onSome: ({ index, question }) => (
      <section className="flex min-w-0 flex-1 flex-col gap-4 p-4">
        <h2 className="font-semibold text-lg">
          {t("question", { number: index + 1 })}
        </h2>
        <QuestionOptions question={question} />
      </section>
    ),
  });
}

/** The options of one question, in the layout of the player, with the teacher's key beside each. */
function QuestionOptions({ question }: { question: Question }) {
  const t = useTranslations("Exams");
  const { exam, slug } = useExam();
  const answer = useMutation(exams.questions.answer).withOptimisticUpdate(
    answerUpdate
  );

  /** Saves the answers and the key of this question as they are now, at the revision the teacher saw. */
  function save(answers: Question["answers"], key: Question["key"]) {
    answer({
      answers,
      examId: exam.id,
      key,
      questionId: question.id,
      revision: question.revision,
      slug,
    });
  }

  return Option.match(choiceOf(question.answers), {
    onNone: () => null,
    onSome: (choice) => (
      <RadioGroup
        aria-label={t("correct")}
        className="grid grid-cols-1 gap-2 md:grid-cols-2"
        onValueChange={(optionId: string) =>
          save(question.answers, markedKey(question.answers, optionId))
        }
        value={markedOption(question.key) ?? ""}
      >
        {Arr.map(choice.options, (option, index) => (
          <OptionField
            index={index}
            key={option.id}
            onText={(text) =>
              save(
                withOptionText(question.answers, option.id, text),
                question.key
              )
            }
            optionId={option.id}
            text={labelText(option.label)}
          />
        ))}
      </RadioGroup>
    ),
  });
}

/** One option: its letter, its text field, and the radio in a dashed outline that marks it correct. */
function OptionField({
  index,
  onText,
  optionId,
  text,
}: {
  index: number;
  onText: (text: string) => void;
  optionId: string;
  text: string;
}) {
  const t = useTranslations("Exams");
  const letter = optionLetter(index);

  return (
    <div className="flex items-center gap-2">
      <span className="grid size-9 shrink-0 place-items-center rounded-md border border-primary border-dashed">
        <Radio aria-label={t("correct-option", { letter })} value={optionId} />
      </span>
      <span aria-hidden className="w-5 shrink-0 font-medium">
        {letter}
      </span>
      <Input
        aria-label={t("option", { letter })}
        onChange={(event) => onText(event.target.value)}
        value={text}
      />
    </div>
  );
}
