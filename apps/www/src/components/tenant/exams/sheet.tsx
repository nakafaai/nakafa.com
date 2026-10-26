import { Input } from "@repo/design-system/components/ui/input";
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
 */
const questionPaper = cva(
  "grid aspect-4/3 w-full min-w-0 content-start gap-6 rounded-xl bg-background p-6 shadow-sm md:p-10",
  {
    defaultVariants: { selected: false },
    variants: {
      selected: {
        false: "ring-1 ring-foreground/10",
        true: "ring-2 ring-primary",
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
 * One option of the paper: its letter, then its rich text, framed as the player frames an option. The
 * frame is the player's own choice frame in the unselected variant, and only the teacher's letter is
 * added to it. The letter is as tall as one line of the frame's text, so the first line of the text
 * and the letter share a line box, and a longer text grows the frame below them. The text is edited
 * here, so the frame takes the text cursor and lets the text be selected, where the button surface
 * would block both.
 */
export function PaperOption({
  children,
  letter,
}: {
  children: ReactNode;
  letter: string;
}) {
  return (
    <div
      className={cn(
        choiceFrame(getTryoutSelectableChoiceVariant({ checked: false })),
        "flex cursor-text select-text items-start gap-3"
      )}
    >
      <span
        aria-hidden
        className="grid size-6 shrink-0 place-items-center rounded-md bg-muted font-medium text-sm"
      >
        {letter}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * The room that one control of an option takes beside its text. The paper keeps it on its static copy,
 * where the control stands when the editor mounts, so an option is as wide in both.
 */
export function ControlRoom() {
  return <span aria-hidden className="size-9 shrink-0" />;
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
