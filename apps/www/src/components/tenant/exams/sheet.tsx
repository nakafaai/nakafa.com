import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Input } from "@repo/design-system/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@repo/design-system/components/ui/input-group";
import { Radio } from "@repo/design-system/components/ui/radio-group";
import {
  Select,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { choiceFrame } from "@/components/tryout/runtime/choice/frame";
import { getTryoutSelectableChoiceVariant } from "@/lib/tryout/appearance";

/** The lines an essay's area shows, as a paper leaves room for a few paragraphs. */
const ESSAY_ROWS = 6;

/**
 * The frame of a paper: a page in the shape of the thumbnails, which a longer question makes taller,
 * with its content from the top. The chosen page is outlined, as a design tool outlines the page in hand.
 * A flex column, since Safari keeps a grid's rows at the height the aspect ratio gave them, so a growing
 * prompt would run over the options below it.
 */
const questionPaper = cva(
  "bg-background flex aspect-4/3 w-full min-w-0 flex-col gap-6 rounded-xl p-6 shadow-sm md:p-10",
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
 * radio for one answer and a check box for several, then its rich text, in the player's choice frame. Only the
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
        "cursor-text select-text"
      )}
    >
      <span className="contents" inert>
        {multiple ? (
          <Checkbox className="mt-1 shrink-0" />
        ) : (
          <Radio className="mt-1 shrink-0" value="" />
        )}
      </span>
      <PaperPartText>{children}</PaperPartText>
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
 * One statement or answer of a matching, as the student's paper sets it: its number or letter, its text, and
 * under a statement the select the student pairs it with, out of reach, since the key is marked in the teacher's layer.
 */
export function PaperPart({
  children,
  name,
  pairs,
}: {
  children: ReactNode;
  name: string;
  /** Whether the part is a statement, which the student pairs with an answer. */
  pairs: boolean;
}) {
  const t = useTranslations("Exams");

  return (
    <li className="grid gap-2">
      <div className="flex min-w-0 items-start gap-3">
        <span className="font-medium tabular-nums">{name}.</span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {pairs ? (
        <div inert>
          <Select>
            <SelectTrigger aria-hidden className="w-32">
              <SelectValue placeholder={t("pair-choose")} />
            </SelectTrigger>
          </Select>
        </div>
      ) : null}
    </li>
  );
}

/**
 * The answer field of a short answer or an essay, as the student finds it on the paper: an empty line
 * for a short answer, and an empty area of several lines for an essay. The teacher writes the accepted
 * answers or the rubric in the layer, never on the paper, so the field takes no text here.
 */
export function PaperLine({ essay = false }: { essay?: boolean }) {
  const t = useTranslations("Exams");
  if (essay) {
    return (
      <Textarea
        aria-label={t("essay-area")}
        disabled
        placeholder={t("essay-placeholder")}
        rows={ESSAY_ROWS}
      />
    );
  }
  return (
    <Input
      aria-label={t("short-line")}
      disabled
      placeholder={t("short-placeholder")}
    />
  );
}

/**
 * The line a numeric answer leaves on a paper: one field the student types a number in, with the unit beside it
 * when the teacher gave one, as the student's paper draws it. It takes no typing in the editor.
 */
export function PaperNumber({ unit }: { unit: string | undefined }) {
  const t = useTranslations("Exams");
  return (
    <InputGroup data-disabled>
      <InputGroupInput
        aria-label={t("number-line")}
        disabled
        inputMode="decimal"
        placeholder={t("number-placeholder")}
      />
      {unit === undefined ? null : (
        <InputGroupAddon align="inline-end">
          <InputGroupText>{unit}</InputGroupText>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}
