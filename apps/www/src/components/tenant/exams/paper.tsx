import { takesRubric } from "@repo/backend/confect/exams/question";
import type { DocumentEditorInstance } from "@repo/design-system/components/editor/document";
import { lazy } from "@repo/design-system/lib/lazy";
import { Array as Arr, Option } from "effect";
import {
  type ReactNode,
  type RefObject,
  Suspense,
  useEffect,
  useRef,
} from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { LinesProvider } from "@/components/exams/lines/board";
import { usePaperText } from "@/components/player/held";
import { PanePortal } from "@/components/shared/panes";
import { isChoice } from "@/components/tenant/exams/answer";
import { ChoiceSheet } from "@/components/tenant/exams/choice";
import { MatchColumn } from "@/components/tenant/exams/columns";
import { PageActions, QuestionGrip } from "@/components/tenant/exams/controls";
import { useQuestionEditing } from "@/components/tenant/exams/edits";
import { isLocked } from "@/components/tenant/exams/freeze";
import { QuestionGapMark } from "@/components/tenant/exams/gap";
import { TeacherLayer } from "@/components/tenant/exams/layer";
import { matchOf } from "@/components/tenant/exams/match";
import { TableSheet } from "@/components/tenant/exams/matrix";
import { ExamPaperMedia } from "@/components/tenant/exams/media";
import type { Question } from "@/components/tenant/exams/optimistic";
import {
  QuestionPageContext,
  useQuestionPage,
} from "@/components/tenant/exams/page";
import { isPlaceholderId } from "@/components/tenant/exams/placeholder";
import {
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
  QuestionPaper,
} from "@/components/tenant/exams/sheet";
import { PaperSketch } from "@/components/tenant/exams/sketch";
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

/** The props of one page of the canvas. */
interface ExamPageProps {
  /** The canvas that scrolls the pages, which decides how far a page is from the view. */
  readonly canvas: RefObject<HTMLElement | null>;
  /** The place of the question in the exam, from zero. */
  readonly index: number;
  /** The question the page shows. */
  readonly question: Question;
}

/**
 * The row above a page's paper: the grip that moves the page, its number, its type, a mark while it needs a
 * key, and its actions. It stays one line at every width: the type and the mark fold to their icons by the row's
 * own width, which `row` names. The type and the mark follow the edit on screen, so a key the teacher just set clears the
 * mark at once, before the server answers. A page the server has not saved yet, or a page of a locked exam, shows its number and
 * its type alone, and the type takes a change only once Convex holds the session.
 */
function PageRow({
  children,
  saved,
}: {
  /** The page's actions, which the page composes while the question takes them. */
  readonly children: ReactNode;
  /** Whether the server has saved the question, so it takes a move and a type. */
  readonly saved: boolean;
}) {
  const t = useTranslations("Exams");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const { editing, locked, number, question } = useQuestionPage();
  const editable = saved && !locked;

  return (
    <div className="@container/row flex min-h-9 items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
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
        <QuestionGapMark question={editing.displayed} />
      </div>
      {children}
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
  const locked = useExamLocked();
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
    <QuestionPageContext
      value={{
        chosen,
        drawn: { prompt, read },
        editing,
        locked,
        number,
        question,
      }}
    >
      <section
        aria-label={t("question", { number })}
        className="flex min-w-0 flex-col gap-2"
        data-page=""
        data-question={question.id}
        id={`question-${question.id}`}
        ref={page}
      >
        <PageRow saved={saved}>
          {saved && !locked ? (
            <PageActions index={index} question={question} />
          ) : null}
        </PageRow>
        {live ? (
          <Suspense fallback={<SketchPaper />}>
            <LivePaper />
          </Suspense>
        ) : (
          <SketchPaper />
        )}
        {chosen ? (
          <PanePortal>
            <TeacherLayer live={live} notes={{ explanation, rubric }} />
          </PanePortal>
        ) : null}
      </section>
    </QuestionPageContext>
  );
}

/**
 * The paper of a page drawn without its editors: the picture, the reading and the prompt the server holds, then the
 * answers with the rooms of the controls the editors bring, so the page keeps its shape until they mount.
 */
function SketchPaper() {
  const { chosen, drawn, question } = useQuestionPage();

  return (
    <QuestionPaper
      prompt={
        <>
          <ExamPaperMedia question={question} />
          {question.reading === null ? null : (
            <ReadingSketch documentId={question.reading} read={drawn.read} />
          )}
          <PreviewProse doc={drawn.prompt} size="paper" />
        </>
      }
      selected={chosen}
    >
      <PaperSketch question={question} withControls />
    </QuestionPaper>
  );
}

/**
 * The paper of a page with its editors: the prompt as an editor, then each answer on its marked line with its
 * controls, then the actions that add a part. The actions show on the chosen page alone, as a design tool shows its
 * handles on the page in hand, and keep their room on every page, so choosing a page moves nothing.
 */
function LivePaper() {
  const t = useTranslations("Exams");
  const { exam } = useExam();
  const { chosen, editing, locked, number, question } = useQuestionPage();
  // The remount key of the page's texts, which is not a lock: a text opens anew when its exam locks or unlocks, and
  // takes the lock in place when the exam is gone (`locked`), so the words the teacher typed stay on screen.
  const opened = isLocked(exam);
  const selection = useExamSelectionStore();
  const { displayed } = editing;
  const match = Option.getOrNull(matchOf(displayed.answers));
  const table = Option.getOrNull(tableOf(displayed.answers));

  return (
    <QuestionPaper
      prompt={
        <>
          <ExamPaperMedia question={question} />
          {question.reading === null ? null : (
            <ExamText
              documentId={question.reading}
              key={`${question.reading}-${opened}`}
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
            key={`${question.prompt}-${opened}`}
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
        </>
      }
      selected={chosen}
    >
      {match === null ? null : (
        <PaperPairs>
          <LinesProvider
            disabled={locked}
            match={match}
            onPairs={editing.setPairs}
            pairs={editing.pairs}
            size="paper"
            stretch={false}
          >
            <MatchColumn match={match} side="sources" />
            <MatchColumn match={match} side="targets" />
          </LinesProvider>
        </PaperPairs>
      )}
      {table === null ? null : <TableSheet table={table} />}
      {Arr.map(Arr.filter(displayed.answers, isChoice), (choice) => (
        <ChoiceSheet choice={choice} key={choice.id} />
      ))}
      <PaperField answers={displayed.answers} />
    </QuestionPaper>
  );
}
