import {
  Add01Icon,
  Copy01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";
import { useHotkeys } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { cva } from "class-variance-authority";
import { Array as Arr, Option, Schema } from "effect";
import { type KeyboardEvent, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { useQuestionActions } from "@/components/tenant/exams/actions";
import { isLocked } from "@/components/tenant/exams/freeze";
import type {
  Question,
  QuestionId,
} from "@/components/tenant/exams/optimistic";
import { isPlaceholderId } from "@/components/tenant/exams/placeholder";
import { QuestionPreview } from "@/components/tenant/exams/preview";
import {
  useActiveQuestion,
  useEditorView,
  useExam,
} from "@/components/tenant/exams/provider";
import { TileKey, tileAfter } from "@/components/tenant/exams/view";

/** Whether a key moves between the tiles. */
const isTileKey = Schema.is(TileKey);

/** The frame of one tile, which shows the question chosen on the canvas and the tile a drag would drop on. */
const tileFrame = cva(
  "relative block aspect-4/3 w-full overflow-hidden rounded-lg border bg-background outline-none hover:border-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50",
  {
    defaultVariants: { current: false, target: false },
    variants: {
      current: { false: "", true: "border-primary ring-2 ring-primary" },
      target: { false: "", true: "border-primary" },
    },
  }
);

/** The number of columns the grid lays its tiles out in now, read from the grid's own layout. */
const columnsOf = (grid: HTMLElement | null) =>
  grid === null
    ? 1
    : Math.max(getComputedStyle(grid).gridTemplateColumns.split(" ").length, 1);

/** The props of one tile of the grid. */
interface TileProps {
  /** Whether the canvas shows this question now. */
  readonly current: boolean;
  /** Whether the tile takes a drag, which a locked exam does not. */
  readonly editable: boolean;
  readonly index: number;
  readonly onDragStart: (questionId: QuestionId) => void;
  /** Drops the dragged question on this tile's place. */
  readonly onDrop: (index: number) => void;
  /** Moves the keyboard focus to another tile, by the key the teacher pressed. */
  readonly onKey: (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => void;
  readonly onSelect: (questionId: QuestionId, selected: boolean) => void;
  readonly question: Question;
  readonly selected: boolean;
}

/**
 * One question as a tile of the grid: its page drawn small with the editor's own preview, its number, and
 * a check that selects it for the grid's actions. A click opens the question on the canvas, a drag moves
 * it to another tile's place, and the arrow keys move between the tiles.
 */
function GridTile({
  current,
  editable,
  index,
  onDragStart,
  onDrop,
  onKey,
  onSelect,
  question,
  selected,
}: TileProps) {
  const t = useTranslations("Exams");
  const open = useEditorView((view) => view.open);
  const [target, setTarget] = useState(false);
  const number = index + 1;
  const saved = !isPlaceholderId(question.prompt);

  return (
    <li className="grid gap-2">
      <button
        aria-current={current ? "true" : undefined}
        className={tileFrame({ current, target })}
        data-tile={index}
        draggable={editable && saved}
        onClick={() => open(question.id)}
        onDragEnd={() => setTarget(false)}
        onDragLeave={() => setTarget(false)}
        onDragOver={(event) => {
          if (editable) {
            event.preventDefault();
            setTarget(true);
          }
        }}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          onDragStart(question.id);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setTarget(false);
          onDrop(index);
        }}
        onKeyDown={(event) => onKey(event, index)}
        type="button"
      >
        <span className="sr-only">
          {t("open-question", { number })}
          {question.key === null ? ` ${t("no-key")}` : null}
        </span>
        <QuestionPreview open={current} question={question} saved={saved} />
      </button>
      <div className="flex items-center gap-2 text-sm">
        {editable ? (
          <Checkbox
            aria-label={t("select-question", { number })}
            checked={selected}
            disabled={!saved}
            onCheckedChange={(checked) => onSelect(question.id, checked)}
          />
        ) : null}
        <span className="tabular-nums">{t("question", { number })}</span>
      </div>
    </li>
  );
}

/**
 * Every question of the exam as a tile, in place of the canvas and the teacher's panel, as a design tool's
 * grid view replaces its editor: a click opens a question on the canvas, a drag reorders the questions,
 * and a toolbar above the tiles duplicates or deletes the selected ones, each shown at once and rolled back
 * when the server refuses it. A tile at the end adds a question. Escape and the footer's grid button go
 * back to the canvas. A locked exam shows its tiles to open, without the toolbar, the drag, or the add tile.
 * The grid lays out two tiles a row on a phone and more on a wider screen, never a dialog or a sheet.
 */
export function ExamGrid() {
  const t = useTranslations("Exams");
  const common = useTranslations("Common");
  const { exam } = useExam();
  const editable = !isLocked(exam);
  const active = useActiveQuestion();
  const toggleGrid = useEditorView((view) => view.toggleGrid);
  const actions = useQuestionActions();
  const grid = useRef<HTMLOListElement>(null);
  const dragged = useRef<QuestionId | null>(null);
  const [selected, setSelected] = useState<readonly QuestionId[]>([]);
  const [asking, setAsking] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  // Escape goes back to the canvas from anywhere in the grid, or from the page itself. The delete question and the
  // footer's menus sit outside the grid and take their own Escape.
  useHotkeys([
    [
      "Escape",
      (event) => {
        const target = event.target;
        if (
          target instanceof Node &&
          (target === document.body || area.current?.contains(target) === true)
        ) {
          toggleGrid();
        }
      },
    ],
  ]);
  const currentId = Option.getOrNull(
    Option.map(active, (page) => page.question.id)
  );
  // Only the questions the exam still holds stay selected, so a question removed elsewhere leaves the selection.
  const chosen = Arr.filter(exam.questions, (question) =>
    Arr.contains(selected, question.id)
  );
  // An exam keeps at least one question, so the grid deletes fewer than all of them.
  const canDelete =
    Arr.isReadonlyArrayNonEmpty(chosen) &&
    chosen.length < exam.questions.length;

  /** Selects or unselects one question for the toolbar's actions. */
  const select = (questionId: QuestionId, on: boolean) =>
    setSelected((current) =>
      on
        ? Arr.append(current, questionId)
        : Arr.filter(current, (id) => id !== questionId)
    );

  /** Moves the keyboard focus to the tile an arrow, Home or End names. */
  const moveFocus = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    if (!isTileKey(event.key)) {
      return;
    }
    event.preventDefault();
    const next = tileAfter(event.key, index, {
      columns: columnsOf(grid.current),
      count: exam.questions.length,
    });
    grid.current?.querySelector<HTMLElement>(`[data-tile="${next}"]`)?.focus();
  };

  /** Duplicates each selected question right after itself, and keeps the copies selected for nothing else. */
  const duplicate = () => {
    Arr.forEach(chosen, (question) => actions.copyQuestion(question));
    setSelected([]);
  };

  /** Deletes the selected questions, once the teacher confirmed it. */
  const remove = () => {
    setAsking(false);
    Arr.forEach(chosen, (question) => actions.removeQuestion(question.id));
    setSelected([]);
  };

  return (
    // The grid scrolls in its scroll area's viewport, under an overlay bar that takes no room; its bar of
    // actions sticks to the viewport's top.
    <ScrollArea
      aria-label={t("grid")}
      className="min-w-0 flex-1 bg-muted/40"
      ref={area}
      render={<section />}
    >
      {editable ? (
        <div className="sticky top-0 z-10 flex min-h-12 flex-wrap items-center gap-2 border-b bg-background px-4 py-2">
          <Checkbox
            aria-label={t("select-all")}
            checked={
              chosen.length === exam.questions.length &&
              exam.questions.length > 0
            }
            onCheckedChange={(checked) =>
              setSelected(
                checked
                  ? Arr.map(exam.questions, (question) => question.id)
                  : []
              )
            }
          />
          <span className="text-muted-foreground text-sm">
            {Arr.isReadonlyArrayNonEmpty(chosen)
              ? t("selected-count", { count: chosen.length })
              : t("select-all")}
          </span>
          <div className="ms-auto flex items-center gap-2">
            <Button
              disabled={!Arr.isReadonlyArrayNonEmpty(chosen)}
              onClick={duplicate}
              size="sm"
              type="button"
              variant="ghost"
            >
              <HugeIcons aria-hidden="true" icon={Copy01Icon} />
              {t("grid-duplicate")}
            </Button>
            <Button
              disabled={!canDelete}
              onClick={() => setAsking(true)}
              size="sm"
              type="button"
              variant="ghost"
            >
              <HugeIcons aria-hidden="true" icon={Delete02Icon} />
              {t("grid-delete")}
            </Button>
          </div>
        </div>
      ) : null}
      <ol
        className="grid grid-cols-2 gap-4 p-4 md:grid-cols-3 md:p-6 xl:grid-cols-4"
        ref={grid}
      >
        {Arr.map(exam.questions, (question, index) => (
          <GridTile
            current={currentId === question.id}
            editable={editable}
            index={index}
            key={question.id}
            onDragStart={(questionId) => {
              dragged.current = questionId;
            }}
            onDrop={(to) => {
              const from = dragged.current;
              dragged.current = null;
              if (from !== null && from !== exam.questions[to]?.id) {
                actions.moveQuestion(from, to);
              }
            }}
            onKey={moveFocus}
            onSelect={select}
            question={question}
            selected={Arr.contains(selected, question.id)}
          />
        ))}
        {editable ? (
          <li className="grid gap-2">
            <button
              aria-label={t("add-question")}
              className={tileFrame({
                class:
                  "flex items-center justify-center gap-2 text-muted-foreground text-sm",
              })}
              onClick={() =>
                actions.addQuestion(
                  Option.getOrNull(
                    Option.map(Arr.last(exam.questions), (last) => last.id)
                  )
                )
              }
              type="button"
            >
              <HugeIcons aria-hidden="true" icon={Add01Icon} />
              {t("add-question")}
            </button>
          </li>
        ) : null}
      </ol>
      <ResponsiveDialog
        description={t("remove-many-description")}
        footer={
          <>
            <Button onClick={() => setAsking(false)} variant="outline">
              {common("cancel")}
            </Button>
            <Button onClick={remove} variant="destructive">
              <HugeIcons aria-hidden="true" icon={Delete02Icon} />
              {t("grid-delete")}
            </Button>
          </>
        }
        open={asking}
        setOpen={setAsking}
        title={t("remove-many-title", { count: chosen.length })}
      />
    </ScrollArea>
  );
}
