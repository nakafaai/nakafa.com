import type { IconSvgElement } from "@hugeicons/react";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { partDirection } from "@repo/backend/confect/exams/letters";
import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { LineMark, MarkedLine } from "@repo/design-system/components/ui/line";
import { Radio } from "@repo/design-system/components/ui/radio-group";
import { cva } from "class-variance-authority";
import { Function as Fn, Option } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { SittingField } from "@/components/exams/sitting/field";
import { writtenOf } from "@/components/exams/sitting/response";

/**
 * The frame of a paper: a page in the shape of the thumbnails, which a longer question makes taller,
 * with its content from the top. The chosen page is outlined, as a design tool outlines the page in hand.
 * On a phone its side padding and the canvas's gutter add up to the player's, so a line wraps as the student reads it.
 * A flex column, since Safari keeps a grid's rows at the height the aspect ratio gave them, so a growing
 * prompt would run over the options below it.
 */
const questionPaper = cva(
  "bg-background flex aspect-4/3 w-full min-w-0 flex-col gap-8 rounded-xl px-3 py-6 shadow-sm md:p-10",
  {
    defaultVariants: { selected: false },
    variants: {
      selected: {
        false: "ring-foreground/10 ring-1",
        true: "ring-primary ring-2",
      },
    },
  }
);

/**
 * The paper of one question, as the student reads it in the player: its text, its picture and reading over its
 * prompt, then its answers. The canvas draws the paper at full size and the thumbnails draw it small, so one
 * component draws both. The page's number sits outside the paper, so nothing inside it is the teacher's own label.
 */
export function QuestionPaper({
  children,
  prompt,
  selected,
}: {
  /** The answers under the prompt: options, a board, a table or a field. */
  children: ReactNode;
  /** The question's text: its picture, its reading and its prompt, in the order the student reads them. */
  prompt: ReactNode;
  selected?: boolean;
}) {
  return (
    <div className={questionPaper({ selected })}>
      <div className="grid gap-6">{prompt}</div>
      {children}
    </div>
  );
}

/**
 * The action that adds a part under a set, an option, a statement or an answer, `shown` on the chosen page alone, as
 * a design tool shows its handles on the page in hand. On any other page, and on a page drawn without its editors,
 * which passes no `onAdd`, it keeps its room hidden, so choosing a page or mounting its editors moves nothing.
 */
export function PartAdd({
  icon,
  label,
  onAdd,
  shown = false,
}: {
  /** The icon of the kind of part it adds, so the two columns of a match never draw the same one. */
  readonly icon: IconSvgElement;
  readonly label: string;
  readonly onAdd?: () => void;
  readonly shown?: boolean;
}) {
  return (
    <div className={shown && onAdd !== undefined ? undefined : "invisible"}>
      <Button onClick={onAdd} size="sm" type="button" variant="outline">
        <HugeIcons aria-hidden="true" icon={icon} />
        {label}
      </Button>
    </div>
  );
}

/** The options of the paper, one column on a narrow paper and two on a wide one, as the player lays them out. */
export function PaperOptions({
  children,
  dir,
}: {
  children: ReactNode;
  /** The way the set reads, which its letters decide. */
  dir: ReturnType<typeof partDirection>;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2" dir={dir}>
      {children}
    </div>
  );
}

/**
 * One option of the paper, as the player draws it: a marked line with the student's own circle and its letter,
 * unmarked and out of reach, a radio for one answer and a check box for several, then the words and the remove
 * control the caller composes. Only the cursor differs, since the words are written here. The key is marked by
 * letter in the teacher's layer, and letters run in the paper's reading order.
 */
export function PaperOption({
  children,
  letter,
  multiple,
}: {
  /** The option's `LineWords`, and its remove control while it may go. */
  children: ReactNode;
  letter: string;
  /** Whether the question takes several answers, so the student meets check boxes. */
  multiple: boolean;
}) {
  return (
    <MarkedLine written>
      <LineMark inert>
        {multiple ? (
          <Checkbox letter={letter} />
        ) : (
          <Radio letter={letter} value="unmarked" />
        )}
      </LineMark>
      {children}
    </MarkedLine>
  );
}

/**
 * A matching on its paper, as the student's paper sets it: the board of its statements, its answers and their lines,
 * with the sentence that says how a line is drawn under it.
 */
export function PaperPairs({ children }: { children: ReactNode }) {
  const t = useTranslations("Exams");

  return (
    <div className="grid min-w-0 gap-3">
      {children}
      <p className="text-muted-foreground text-sm">{t("pair-hint")}</p>
    </div>
  );
}

/**
 * The field of a written answer on a paper: the student's own field, with its keypad and its unit, out of
 * reach. The teacher writes the accepted answers or the rubric in the layer, never on the paper.
 */
export function PaperField({ answers }: { answers: readonly Interaction[] }) {
  const entry = writtenOf(answers);
  if (Option.isNone(entry)) {
    return null;
  }
  return (
    <div inert>
      <SittingField
        entry={entry.value}
        labelledBy=""
        onType={Fn.constVoid}
        saved=""
        text=""
      />
    </div>
  );
}
