"use client";

import { useMutation } from "@confect/react";
import { useCallbackRef } from "@mantine/hooks";
import type { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { Input } from "@repo/design-system/components/ui/input";
import { Radio } from "@repo/design-system/components/ui/radio-group";
import { Array as Arr, Effect, Function as Fn, Option } from "effect";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";
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
import { isPlaceholderId } from "@/components/tenant/exams/placeholder";
import {
  useActiveQuestion,
  useExam,
  useExamSelection,
} from "@/components/tenant/exams/provider";
import {
  QuestionSheet,
  QuestionSheetOption,
  QuestionSheetOptions,
  QuestionSheetPrompt,
} from "@/components/tenant/exams/sheet";
import { makeQuietSaver } from "@/lib/save/quiet";

/** The prompt loads when the canvas shows a saved question, never with the page. */
const ExamPrompt = dynamic(
  () =>
    import("@/components/tenant/exams/prompt").then(
      (module) => module.ExamPrompt
    ),
  { loading: () => null, ssr: false }
);

/** The quiet period after the last keystroke of an option, before its text is saved. */
const OPTION_SAVE_QUIET = "500 millis";

/**
 * The canvas of the selected question: its number, its prompt, then its options, each a
 * text field with a radio that marks the correct answer. A question the server has not
 * saved yet shows its options only, and they take no change until the server answers.
 */
export function ExamCanvas() {
  const { slug, exam } = useExam();
  const active = useActiveQuestion();
  const pending = useExamSelection((state) => state.pending);

  return Option.match(active, {
    onNone: () => null,
    onSome: ({ index, question }) => {
      const saved = !(
        Arr.contains(pending, question.id) || isPlaceholderId(question.prompt)
      );
      return (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-muted/40 p-4">
          <QuestionSheet number={index + 1}>
            {saved ? (
              <QuestionSheetPrompt>
                <ExamPrompt
                  key={question.prompt}
                  prompt={question.prompt}
                  slug={slug}
                />
              </QuestionSheetPrompt>
            ) : null}
            <QuestionOptions
              examId={exam.id}
              key={question.id}
              pending={!saved}
              question={question}
            />
          </QuestionSheet>
        </section>
      );
    },
  });
}

/**
 * The options of one question, in the layout of the player, with the teacher's key beside
 * each. A key change saves at once, and each option text saves after its quiet period.
 */
function QuestionOptions({
  examId,
  pending,
  question,
}: {
  examId: Id<"exams">;
  pending: boolean;
  question: Question;
}) {
  const t = useTranslations("Exams");
  const { slug } = useExam();
  const answer = useMutation(exams.questions.answer).withOptimisticUpdate(
    answerUpdate
  );

  /** Saves the answers and the key of this question as they are now, at the revision the teacher saw. */
  const saveAnswers = (answers: Question["answers"], key: Question["key"]) => {
    runExamAction(
      sentAction(() =>
        answer({
          answers,
          examId,
          key,
          questionId: question.id,
          revision: question.revision,
          slug,
        })
      ),
      { onFailure: Fn.constVoid, onSuccess: Fn.constVoid }
    );
  };

  return Option.match(choiceOf(question.answers), {
    onNone: () => null,
    onSome: (choice) => (
      <QuestionSheetOptions
        aria-label={t("correct")}
        disabled={pending}
        onValueChange={(optionId: string) =>
          saveAnswers(question.answers, markedKey(question.answers, optionId))
        }
        value={markedOption(question.key) ?? ""}
      >
        {Arr.map(choice.options, (option, index) => (
          <OptionField
            index={index}
            key={option.id}
            onSave={(text) =>
              saveAnswers(
                withOptionText(question.answers, option.id, text),
                question.key
              )
            }
            optionId={option.id}
            pending={pending}
            text={labelText(option.label)}
          />
        ))}
      </QuestionSheetOptions>
    ),
  });
}

/**
 * One option: its letter, its text field, and the radio in a dashed outline that marks it
 * correct. The field shows what the teacher typed at once. Its text is saved after the
 * quiet period, or at once when the field loses focus, and the latest save is the one that
 * runs.
 */
function OptionField({
  index,
  onSave,
  optionId,
  pending,
  text,
}: {
  index: number;
  onSave: (text: string) => void;
  optionId: string;
  pending: boolean;
  text: string;
}) {
  const t = useTranslations("Exams");
  const letter = optionLetter(index);
  const [draft, setDraft] = useState<string | null>(null);
  // The save calls the latest `onSave`, so a save made after a quiet period uses the answers,
  // the key, and the revision of the render that is on screen when it runs.
  const save = useCallbackRef(onSave);
  const [saver] = useState(() =>
    Effect.runSync(
      makeQuietSaver((run: () => void) => Effect.sync(run), OPTION_SAVE_QUIET)
    )
  );

  return (
    <QuestionSheetOption
      letter={letter}
      radio={
        <Radio aria-label={t("correct-option", { letter })} value={optionId} />
      }
    >
      <Input
        aria-label={t("option", { letter })}
        onBlur={() => {
          Effect.runFork(saver.flush);
          setDraft(null);
        }}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          Effect.runFork(saver.touch(() => save(next)));
        }}
        readOnly={pending}
        value={draft ?? text}
      />
    </QuestionSheetOption>
  );
}
