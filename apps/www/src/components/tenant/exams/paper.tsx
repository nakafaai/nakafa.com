import { Alert02Icon } from "@hugeicons/core-free-icons";
import { questionGap } from "@repo/backend/confect/exams/parts";
import {
  type QuestionTemplate,
  takesRubric,
} from "@repo/backend/confect/exams/question";
import type { DocumentEditorInstance } from "@repo/design-system/components/editor/document";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { statusIconVariants } from "@repo/design-system/lib/status";
import { Array as Arr, Match, Option } from "effect";
import { lazy, type RefObject, Suspense, useEffect, useRef } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { usePaperText } from "@/components/player/held";
import { PanePortal } from "@/components/shared/panes";
import { isChoice } from "@/components/tenant/exams/answer";
import { ChoiceSheet } from "@/components/tenant/exams/choice";
import { MatchColumn } from "@/components/tenant/exams/columns";
import { PageActions, QuestionGrip } from "@/components/tenant/exams/controls";
import {
  type QuestionEditing,
  useQuestionEditing,
} from "@/components/tenant/exams/edits";
import { isLocked } from "@/components/tenant/exams/freeze";
import { TeacherLayer } from "@/components/tenant/exams/layer";
import { matchOf } from "@/components/tenant/exams/match";
import { TableSheet } from "@/components/tenant/exams/matrix";
import { ExamPaperMedia } from "@/components/tenant/exams/media";
import type { Question } from "@/components/tenant/exams/optimistic";
import { isPlaceholderId } from "@/components/tenant/exams/placeholder";
import {
  PaperSketch,
  PreviewProse,
  ReadingSketch,
  usePageDocument,
  usePageRead,
} from "@/components/tenant/exams/preview";
import {
  useExam,
  useExamLocked,
  useExamSelection,
  useExamSelectionStore,
} from "@/components/tenant/exams/provider";
import { ExamDocument } from "@/components/tenant/exams/rich";
import { activeQuestion } from "@/components/tenant/exams/selection";
import {
  PaperField,
  PaperPairs,
  PaperPrompt,
  QuestionPaper,
} from "@/components/tenant/exams/sheet";
import { tableOf } from "@/components/tenant/exams/table";
import { QuestionType } from "@/components/tenant/exams/type";
import { usePageWindow } from "@/components/tenant/exams/window";

/**
 * The prompt loads when a page mounts its editors, never with the page. Until it loads, the page
 * keeps its paper on the screen, since the live paper of the page suspends until the prompt loads.
 */
const ExamText = lazy(() =>
  import("@/components/tenant/exams/text").then((module) => ({
    default: module.ExamText,
  }))
);

/** The mark of a question with a part that shows nothing, in the words of its template. */
const emptyMark = (template: QuestionTemplate) =>
  Match.value(template).pipe(
    Match.when("match", () => "page-empty-match" as const),
    Match.when("table", () => "page-empty-table" as const),
    Match.orElse(() => "page-empty-choice" as const)
  );

/** The props of one page of the canvas. */
interface ExamPageProps {
  /** The canvas that scrolls the pages, which decides how far a page is from the view. */
  readonly canvas: RefObject<HTMLElement | null>;
  /** The place of the question in the exam, from zero. */
  readonly index: number;
  /** The question the page shows. */
  readonly question: Question;
}

/** The props of the row above a page's paper. */
interface PageRowProps {
  /** The edits of the question, whose type the row shows and changes at once. */
  readonly editing: QuestionEditing;
  /** The place of the question in the exam, from zero. */
  readonly index: number;
  readonly question: Question;
  /** Whether the server has saved the question, so it takes a move, a type and its actions. */
  readonly saved: boolean;
}

/**
 * The row above a page's paper: the grip that moves the page, its number, its type, a mark while it needs a
 * key, and its actions, which keep the row's end while the rest wraps on a narrow screen. The type and the mark follow the edit on screen, so a key the teacher just set clears the
 * mark at once, before the server answers. A page the server has not saved yet, or a page of a locked exam, shows its number and
 * its type alone, and the type takes a change only once Convex holds the session.
 */
function PageRow({ editing, index, question, saved }: PageRowProps) {
  const t = useTranslations("Exams");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const locked = useExamLocked();
  const editable = saved && !locked;
  const number = index + 1;

  return (
    <div className="flex min-h-9 items-center justify-between gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {editable ? (
          <QuestionGrip number={number} questionId={question.id} />
        ) : (
          <span aria-hidden className="size-8 shrink-0" />
        )}
        <h2 className="shrink-0 text-sm font-medium">
          {t("question", { number })}
        </h2>
        <QuestionType
          editable={editable && isSettled}
          onChange={editing.setTemplate}
          template={editing.displayed.template}
        />
        {/* What keeps the question from being scheduled, as the schedule names it: an empty part, or no key. */}
        {Option.match(questionGap(editing.displayed), {
          onNone: () => null,
          onSome: (gap) => (
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <HugeIcons
                aria-hidden="true"
                className={statusIconVariants({
                  className: "size-3.5",
                  tone: "warning",
                })}
                icon={Alert02Icon}
              />
              {t(
                gap === "empty"
                  ? emptyMark(editing.displayed.template)
                  : "page-no-key"
              )}
            </span>
          ),
        })}
      </div>
      {editable ? <PageActions index={index} question={question} /> : null}
    </div>
  );
}

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
export function ExamPage({ canvas, index, question }: ExamPageProps) {
  const t = useTranslations("Exams");
  const { exam } = useExam();
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
  const { measured, mounted, reached } = usePageWindow(page, canvas);
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
  // The server opens a text only for a signed-in editor, so a page reads none before Convex holds the
  // session. It reads its prompt while its editors are not mounted, and while they load until the
  // prompt's editor holds it, so the drawn paper keeps the prompt on screen until the editor takes over.
  const read = reached && isSettled;
  // The notes are drawn only in the chosen page's panel, so a live page that is not chosen reads none.
  const readNotes = read && (chosen || !live);
  const { answered, doc: prompt } = usePageRead({
    documentId: question.prompt,
    editing: live,
    open: chosen,
    read,
    saved,
  });
  // A page far from the view moves nothing on screen when its text arrives, so the canvas waits only for the near ones.
  usePaperText(question.id, !saved || answered || (measured && !reached));
  const rubric = usePageDocument({
    documentId: question.rubric,
    editing: live,
    open: chosen,
    read: readNotes && takesRubric(question.template),
    saved,
  });
  const explanation = usePageDocument({
    documentId: question.explanation,
    editing: live,
    open: chosen,
    read: readNotes,
    saved,
  });
  return (
    <section
      aria-label={t("question", { number })}
      className="flex min-w-0 flex-col gap-2"
      data-page=""
      data-question={question.id}
      id={`question-${question.id}`}
      ref={page}
    >
      <PageRow
        editing={editing}
        index={index}
        question={question}
        saved={saved}
      />
      {live ? (
        <Suspense
          fallback={
            <QuestionPaper selected={chosen}>
              <PaperPrompt>
                <ExamPaperMedia question={question} />
                {question.reading === null ? null : (
                  <ReadingSketch documentId={question.reading} read={read} />
                )}
                <PreviewProse article doc={prompt} size="paper" />
              </PaperPrompt>
              <PaperSketch question={question} withControls />
            </QuestionPaper>
          }
        >
          <LivePaper editing={editing} number={number} question={question} />
        </Suspense>
      ) : (
        <QuestionPaper selected={chosen}>
          <PaperPrompt>
            <ExamPaperMedia question={question} />
            {question.reading === null ? null : (
              <ReadingSketch documentId={question.reading} read={read} />
            )}
            <PreviewProse article doc={prompt} size="paper" />
          </PaperPrompt>
          <PaperSketch question={question} withControls />
        </QuestionPaper>
      )}
      {chosen ? (
        <PanePortal>
          <TeacherLayer
            editing={editing}
            live={live}
            notes={{ explanation, rubric }}
            number={number}
            question={question}
          />
        </PanePortal>
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
  editing,
  number,
  question,
}: {
  editing: QuestionEditing;
  number: number;
  question: Question;
}) {
  const t = useTranslations("Exams");
  const { exam } = useExam();
  const chosen = useExamSelection((state) =>
    Option.exists(
      activeQuestion(exam.questions, state.selected),
      (active) => active.question.id === question.id
    )
  );
  // The prompt's editor opens anew when its exam locks or unlocks, and takes a lock in place when the exam is gone,
  // so the words the teacher typed stay on screen.
  const frozen = isLocked(exam);
  const locked = useExamLocked();
  const selection = useExamSelectionStore();
  const { displayed } = editing;
  const match = Option.getOrNull(matchOf(displayed.answers));
  const table = Option.getOrNull(tableOf(displayed.answers));

  return (
    <QuestionPaper selected={chosen}>
      <PaperPrompt>
        <ExamPaperMedia question={question} />
        {question.reading === null ? null : (
          <ExamText
            documentId={question.reading}
            key={`${question.reading}-${frozen}`}
          >
            <ExamDocument
              label={t("reading-text", { number })}
              placeholder={t("reading-placeholder")}
              size="paper"
            />
          </ExamText>
        )}
        <ExamText
          documentId={question.prompt}
          key={`${question.prompt}-${frozen}`}
          onOpen={(editor: DocumentEditorInstance) => {
            const { write, writing } = selection.getState();
            if (writing !== question.id) {
              return;
            }
            write(null);
            // A teacher who went on to write somewhere else meanwhile keeps the caret there.
            if (
              document.activeElement?.closest(
                "[contenteditable='true'], input, textarea"
              ) === null
            ) {
              editor.commands.focus("end");
            }
          }}
        >
          <ExamDocument
            label={t("question-text", { number })}
            placeholder={t("prompt-placeholder")}
            size="paper"
          />
        </ExamText>
      </PaperPrompt>
      {match === null ? null : (
        <PaperPairs>
          <MatchColumn
            chosen={chosen}
            editing={editing}
            frozen={locked}
            match={match}
            number={number}
            question={question}
            side="sources"
          />
          <MatchColumn
            chosen={chosen}
            editing={editing}
            frozen={locked}
            match={match}
            number={number}
            question={question}
            side="targets"
          />
        </PaperPairs>
      )}
      {table === null ? null : (
        <TableSheet
          chosen={chosen}
          editing={editing}
          frozen={locked}
          number={number}
          question={question}
          table={table}
        />
      )}
      {Arr.map(Arr.filter(displayed.answers, isChoice), (choice) => (
        <ChoiceSheet
          choice={choice}
          chosen={chosen}
          editing={editing}
          key={choice.id}
          number={number}
          question={question}
        />
      ))}
      <PaperField answers={displayed.answers} />
    </QuestionPaper>
  );
}
