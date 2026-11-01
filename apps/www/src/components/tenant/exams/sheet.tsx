import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Radio } from "@repo/design-system/components/ui/radio-group";
import {
  Select,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import { Function as Fn, Option } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { SittingField } from "@/components/exams/sitting/field";
import { writtenOf } from "@/components/exams/sitting/response";
import { choiceFrame } from "@/components/tryout/runtime/choice/frame";
import { getTryoutSelectableChoiceVariant } from "@/lib/tryout/appearance";

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
 * The paper of one question, as the student reads it in the player: its prompt, then its
 * options. The canvas draws the paper at full size and the thumbnails draw it small, so one
 * component draws both. The page's number sits outside the paper, so nothing inside it is
 * the teacher's own label.
 */
export function QuestionPaper({
  children,
  selected,
}: {
  children: ReactNode;
  selected?: boolean;
}) {
  return <div className={questionPaper({ selected })}>{children}</div>;
}

/** A question's text on its paper: its reading, when it has one, over its prompt, as the student reads them. */
export function PaperPrompt({ children }: { children: ReactNode }) {
  return <div className="grid gap-6">{children}</div>;
}

/** The room of the action that adds an option, which a page keeps while its editors are not mounted. */
export function OptionAddRoom() {
  return <span aria-hidden className="h-8" />;
}

/** The options of the paper, one column on a narrow paper and two on a wide one, as the player lays them out. */
export function PaperOptions({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{children}</div>
  );
}

/**
 * One option of the paper, as the player draws it: the student's own control, unmarked and out of reach, a
 * radio for one answer and a check box for several, then its letter and rich text, in the player's choice frame. Only the
 * cursor differs, since the text is edited here. The key is marked by letter in the teacher's layer, and the
 * letters run in the paper's reading order.
 */
export function PaperOption({
  children,
  multiple,
}: {
  children: ReactNode;
  /** Whether the question takes several answers, so the student meets check boxes. */
  multiple: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium",
        choiceFrame(getTryoutSelectableChoiceVariant({ checked: false })),
        "w-full cursor-text select-text"
      )}
    >
      <span className="contents" inert>
        {multiple ? (
          <Checkbox className="mt-1 shrink-0" />
        ) : (
          <Radio className="mt-1 shrink-0" value="" />
        )}
      </span>
      {children}
    </div>
  );
}

/** The text of an option or a statement. A touch screen shows the remove control at all times, so the text stops short of it. */
export function PaperPartText({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 flex-1 pointer-coarse:group-has-[[data-remove]]/option:pe-8">
      {children}
    </div>
  );
}

/** The two columns of a matching, as the student's paper sets them. */
export function PaperPairs({ children }: { children: ReactNode }) {
  return <div className="grid min-w-0 gap-6 md:grid-cols-2">{children}</div>;
}

/** The parts of one column of a matching, as the student's paper lists them. */
export function PaperParts({ children }: { children: ReactNode }) {
  return <ol className="grid content-start gap-3">{children}</ol>;
}

/**
 * One statement or answer of a matching, as the student's paper sets it: its number or letter and its text,
 * with what stands under it, the select of a statement.
 */
export function PaperPart({
  below,
  children,
  name,
}: {
  /** What stands under the part: `PaperPairSelect` under a statement, nothing under an answer. */
  below: ReactNode;
  children: ReactNode;
  name: string;
}) {
  return (
    <li className="grid gap-2">
      <div className="flex min-w-0 items-start gap-3">
        <span className="font-medium tabular-nums">{name}.</span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {below}
    </li>
  );
}

/** The select a student pairs a statement with, out of reach, since the key is marked in the teacher's layer. */
export function PaperPairSelect() {
  const t = useTranslations("Exams");

  return (
    <div inert>
      <Select>
        <SelectTrigger aria-hidden className="w-32">
          <SelectValue placeholder={t("pair-choose")} />
        </SelectTrigger>
      </Select>
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
