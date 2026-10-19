import { cn } from "cn";
import type { ReactNode } from "react";
import { choiceFrame } from "@/components/tryout/runtime/choice/frame";
import { getTryoutSelectableChoiceVariant } from "@/lib/tryout/appearance";

/**
 * The paper of one question, as the student reads it in the player: its prompt, then its
 * options. The canvas draws the paper at full size and the thumbnails draw it small, so one
 * component draws both. The page's number sits outside the paper, so nothing inside it is
 * the teacher's own label.
 */
export function QuestionPaper({ children }: { children: ReactNode }) {
  return (
    <div className="grid w-full min-w-0 gap-6 rounded-xl bg-background p-6 shadow-sm ring-1 ring-foreground/10 md:p-10">
      {children}
    </div>
  );
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
 * added to it.
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
        "flex items-start gap-3"
      )}
    >
      <span
        aria-hidden
        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-muted font-medium text-sm"
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
