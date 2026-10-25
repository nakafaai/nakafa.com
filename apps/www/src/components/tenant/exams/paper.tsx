import { useMutation } from "@confect/react";
import { Add01Icon, Alert02Icon } from "@hugeicons/core-free-icons";
import { useCallbackRef } from "@mantine/hooks";
import exams from "@repo/backend/confect/_generated/refs/exams";
import {
  CHOICE_OPTIONS_MAX,
  CHOICE_OPTIONS_MIN,
} from "@repo/backend/confect/exams/question";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr, Effect, Option } from "effect";
import {
  lazy,
  type RefObject,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";
import {
  choiceOf,
  keyWithoutOption,
  markedKey,
  markedOption,
  type OptionLabel,
  optionLetter,
  withOptionAdded,
  withOptionLabel,
  withOptionRemoved,
} from "@/components/tenant/exams/answer";
import { PageActions, QuestionGrip } from "@/components/tenant/exams/controls";
import { isLocked } from "@/components/tenant/exams/freeze";
import { TeacherLayer } from "@/components/tenant/exams/layer";
import {
  answerUpdate,
  type Question,
} from "@/components/tenant/exams/optimistic";
import { OptionRow } from "@/components/tenant/exams/option";
import { TeacherPortal } from "@/components/tenant/exams/panel";
import { isPlaceholderId } from "@/components/tenant/exams/placeholder";
import {
  PaperSketch,
  usePageDocument,
} from "@/components/tenant/exams/preview";
import { useExam, useExamSelection } from "@/components/tenant/exams/provider";
import { activeQuestion } from "@/components/tenant/exams/selection";
import { PaperOptions, QuestionPaper } from "@/components/tenant/exams/sheet";
import { usePageWindow } from "@/components/tenant/exams/window";
import {
  makeQuestionWriter,
  type QuestionDraft,
  type QuestionWrite,
} from "@/components/tenant/exams/writer";

/**
 * The prompt loads when a page mounts its editors, never with the page. Until it loads, the page
 * keeps its paper on the screen, since the live paper of the page suspends until the prompt loads.
 */
const ExamText = lazy(() =>
  import("@/components/tenant/exams/text").then((module) => ({
    default: module.ExamText,
  }))
);

/** The props of one page of the canvas. */
interface ExamPageProps {
  /** The canvas that scrolls the pages, which decides how far a page is from the view. */
  readonly canvas: RefObject<HTMLElement | null>;
  /** The number of questions in the exam, which decides whether a page may be removed. */
  readonly count: number;
  /** The place of the question in the exam, from zero. */
  readonly index: number;
  /** The question the page shows. */
  readonly question: Question;
}

/**
 * The answers and the key of one question as its page shows them, with the saves that change them.
 * The page owns the writer, so the paper's option labels and the layer's key save in the same order,
 * and each save starts from the newest draft the writer knows. A change shows at once, and the page
 * shows the server's answer once every save of the question has settled.
 */
function useQuestionEditing(question: Question) {
  const { exam, slug } = useExam();
  const answer = useMutation(exams.questions.answer).withOptimisticUpdate(
    answerUpdate
  );
  // The writer sends through the latest mutation. It keeps the saves of this question in order, and each
  // save starts from the newer of the draft its last answer returned and the question the render holds.
  const send = useCallbackRef((draft: QuestionDraft) =>
    sentAction(() =>
      answer({
        answers: draft.answers,
        examId: exam.id,
        key: draft.key,
        questionId: question.id,
        revision: draft.revision,
        slug,
      })
    ).pipe(
      Effect.map((view) => ({
        answers: view.answers,
        key: view.key,
        revision: view.revision,
      }))
    )
  );
  // The question as the render holds it, which the writer reads each time a save starts.
  const rendered = useCallbackRef(
    (): QuestionDraft => ({
      answers: question.answers,
      key: question.key,
      revision: question.revision,
    })
  );
  // The writer lives with this page. A page that unmounts with a save in flight leaves that save to finish.
  const [writer] = useState(() =>
    Effect.runSync(makeQuestionWriter(send, Effect.sync(rendered)))
  );

  // A save shows its change at once, even while an earlier save of this question is still in flight. Each click
  // applies its edit to the draft the last click left on screen, and the render shows again once every save of
  // this question has settled.
  const [shown, setShown] = useState<QuestionDraft | null>(null);
  const shownRef = useRef<QuestionDraft | null>(null);
  const unsettled = useRef(0);
  const current = () => shownRef.current ?? rendered();

  /**
   * Saves the answers and the key that `edit` makes of this question, and shows them at once. The edit runs on
   * the draft the writer starts from, so the edits of one question land in the order they were made. `unstored`
   * runs when the server does not store the change, so the option that asked can take its text back.
   */
  const saveAnswers = (
    edit: (draft: QuestionDraft) => QuestionWrite,
    unstored?: () => void
  ) => {
    const base = current();
    const next: QuestionDraft = { ...edit(base), revision: base.revision };
    shownRef.current = next;
    setShown(next);
    unsettled.current += 1;
    const settle = () => {
      unsettled.current -= 1;
      if (unsettled.current === 0) {
        shownRef.current = null;
        setShown(null);
      }
    };
    runExamAction(writer.save(edit), {
      onFailure: () => {
        settle();
        unstored?.();
      },
      onSuccess: settle,
    });
  };

  /** Marks one option as the key of the question, which saves at once. Marking the key's option again saves nothing. */
  const markOption = (optionId: string) => {
    if (markedOption(current().key) !== optionId) {
      saveAnswers((draft) => ({
        answers: draft.answers,
        key: markedKey(draft.answers, optionId),
      }));
    }
  };

  return {
    displayed: shown ?? question,
    markOption,
    saveAnswers,
  };
}

/** The answers and the key of one question, as its page edits them. */
type QuestionEditing = ReturnType<typeof useQuestionEditing>;

/**
 * One question as a page of the canvas: a row above the paper names the question and holds its
 * actions, and the paper below it is what the student reads, with nothing else on the canvas. The
 * chosen page draws its teacher layer into the editor's panel. A page mounts its editors while it is within a viewport of the canvas and
 * unmounts them past three viewports, and only once Convex holds the session, since the server
 * opens a text only for a signed-in editor. Until then, and while it is far away, the paper shows
 * the same document as drawn text, so the page keeps its shape. The drawn paper stays until the
 * prompt's editor loads. A page the server has not saved yet shows its options only, and they take
 * no change until it answers.
 */
export function ExamPage({ canvas, count, index, question }: ExamPageProps) {
  const t = useTranslations("Exams");
  const { exam } = useExam();
  const frozen = isLocked(exam);
  // Each page reads a boolean for its own choice, so a change of the choice renders only the two pages it moves between.
  const awaiting = useExamSelection((state) =>
    Arr.contains(state.pending, question.id)
  );
  // The page the teacher is on, the first one before any choice, as the footer and the panel name it.
  const chosen = useExamSelection((state) =>
    Option.exists(
      activeQuestion(exam.questions, state.selected),
      (active) => active.question.id === question.id
    )
  );
  const focused = useExamSelection((state) => state.focus === question.id);
  const settleFocus = useExamSelection((state) => state.settleFocus);
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const saved = !(awaiting || isPlaceholderId(question.prompt));
  const number = index + 1;
  const page = useRef<HTMLElement>(null);
  const { mounted, reached } = usePageWindow(page, canvas);
  const editing = useQuestionEditing(question);
  // A question the teacher just added or copied, which the server has not saved yet, comes into view.
  useEffect(() => {
    if (chosen && !saved) {
      page.current?.scrollIntoView({ block: "nearest" });
    }
  }, [chosen, saved]);
  // A move by the keyboard or by the page's own button hands the focus to the grip of the moved page.
  useEffect(() => {
    if (focused) {
      page.current?.querySelector<HTMLElement>("[data-grip]")?.focus();
      settleFocus();
    }
  }, [focused, settleFocus]);

  const live = mounted && saved && isSettled;
  const read = reached && !live;
  const prompt = usePageDocument({
    documentId: question.prompt,
    open: chosen,
    read,
    saved,
  });
  const rubric = usePageDocument({
    documentId: question.rubric,
    open: chosen,
    read,
    saved,
  });
  const explanation = usePageDocument({
    documentId: question.explanation,
    open: chosen,
    read,
    saved,
  });
  const paper = (
    <PaperSketch
      doc={prompt}
      question={question}
      selected={chosen}
      withControls
    />
  );

  return (
    <section
      aria-label={t("question", { number })}
      className="flex min-w-0 flex-col gap-2"
      data-page=""
      data-question={question.id}
      id={`question-${question.id}`}
      ref={page}
    >
      <div className="flex min-h-9 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {saved && !frozen ? (
            <QuestionGrip number={number} questionId={question.id} />
          ) : (
            <span aria-hidden className="size-8 shrink-0" />
          )}
          <h2 className="font-medium text-sm">{t("question", { number })}</h2>
          {question.key === null ? (
            <span className="flex items-center gap-1 text-muted-foreground text-xs">
              <HugeIcons
                aria-hidden="true"
                className="size-3.5 text-primary"
                icon={Alert02Icon}
              />
              {t("page-no-key")}
            </span>
          ) : null}
        </div>
        {saved && !frozen ? (
          <PageActions count={count} index={index} question={question} />
        ) : null}
      </div>
      {live ? (
        <Suspense fallback={paper}>
          <LivePaper
            chosen={chosen}
            editing={editing}
            number={number}
            question={question}
          />
        </Suspense>
      ) : (
        paper
      )}
      {chosen ? (
        <TeacherPortal>
          <TeacherLayer
            live={live}
            notes={{ explanation, rubric }}
            number={number}
            onMark={editing.markOption}
            question={question}
            shown={editing.displayed}
          />
        </TeacherPortal>
      ) : null}
    </section>
  );
}

/**
 * The paper of a page with its editors: the prompt as an editor, then each option with its controls,
 * then the action that adds an option. The action shows on the chosen page alone, as a design tool
 * shows its handles on the page in hand, and its row keeps its room on every page, so choosing a
 * page moves nothing.
 */
function LivePaper({
  chosen,
  editing,
  number,
  question,
}: {
  chosen: boolean;
  editing: QuestionEditing;
  number: number;
  question: Question;
}) {
  const t = useTranslations("Exams");
  const { exam } = useExam();
  const frozen = isLocked(exam);
  const { displayed, saveAnswers } = editing;
  const choice = Option.getOrNull(choiceOf(displayed.answers));
  // The label the server holds for an option. Its editor starts from that label, and a label the server does not
  // store goes back to it, so the editor never keeps text that is not saved. An option the server does not hold
  // yet has the label the paper shows.
  const savedLabel = (option: {
    readonly id: string;
    readonly label: OptionLabel;
  }): OptionLabel =>
    Option.match(choiceOf(question.answers), {
      onNone: () => option.label,
      onSome: (saved) =>
        Option.match(
          Arr.findFirst(saved.options, (item) => item.id === option.id),
          {
            onNone: () => option.label,
            onSome: (item) => item.label,
          }
        ),
    });

  const canAddOption =
    choice !== null && choice.options.length < CHOICE_OPTIONS_MAX && !frozen;

  return (
    <QuestionPaper selected={chosen}>
      <ExamText
        documentId={question.prompt}
        key={`${question.prompt}-${frozen}`}
        label={t("question-text", { number })}
        placeholder={t("prompt-placeholder")}
      />
      {choice === null ? null : (
        <PaperOptions>
          {Arr.map(choice.options, (option, index) => (
            <OptionRow
              key={option.id}
              label={savedLabel(option)}
              letter={optionLetter(index)}
              locked={frozen}
              number={number}
              onRemove={
                choice.options.length > CHOICE_OPTIONS_MIN
                  ? () =>
                      saveAnswers((draft) => ({
                        answers: withOptionRemoved(draft.answers, option.id),
                        key: keyWithoutOption(draft.key, option.id),
                      }))
                  : null
              }
              onSave={(label: OptionLabel, unstored: () => void) =>
                saveAnswers(
                  (draft) => ({
                    answers: withOptionLabel(draft.answers, option.id, label),
                    key: draft.key,
                  }),
                  unstored
                )
              }
            />
          ))}
        </PaperOptions>
      )}
      {canAddOption ? (
        <div className={chosen ? undefined : "invisible"}>
          <Button
            onClick={() =>
              saveAnswers((draft) => ({
                answers: withOptionAdded(draft.answers),
                key: draft.key,
              }))
            }
            size="sm"
            type="button"
            variant="ghost"
          >
            <HugeIcons aria-hidden="true" icon={Add01Icon} />
            {t("option-add")}
          </Button>
        </div>
      ) : null}
    </QuestionPaper>
  );
}
