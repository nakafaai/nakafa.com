import { Activity, type ReactNode } from "react";
import { useTranslations } from "use-intl";
import { readQuestionIds } from "@/components/player/ids";
import { usePlayer } from "@/components/player/provider";

/**
 * One question of the player. The list shows every question, and one at a time
 * shows only the current one. A question that is not shown stays mounted
 * inside `Activity`: its answer and focus survive, switching is instant, and
 * the server renders only the questions that are shown. The article holds its
 * question's own flag in its top end corner (`PlayerQuestionFlag`).
 */
export function PlayerQuestion({
  children,
  id,
  labelledBy,
  questionKey,
}: {
  children: ReactNode;
  /** The DOM id of the article. */
  id: string;
  /** The DOM id of the heading that names the article. */
  labelledBy: string;
  /** The key that the navigator and the keys name this question by. */
  questionKey: string;
}) {
  const shown = usePlayer(
    (state) => state.mode === "list" || state.current === questionKey
  );

  return (
    <Activity mode={shown ? "visible" : "hidden"}>
      <article
        aria-labelledby={labelledBy}
        className="relative outline-none"
        data-player-key={questionKey}
        id={id}
        tabIndex={-1}
      >
        {children}
      </article>
    </Activity>
  );
}

/**
 * The head of one question, the same wherever a question is answered or reviewed: its number in a circle
 * at the start, which links to the question itself, and the question's actions at the end. The number
 * names the question for a screen reader through its heading.
 */
export function PlayerQuestionHeader({
  children,
  number,
}: {
  /** The question's actions, at the end of the row. */
  children?: ReactNode;
  number: number;
}) {
  const t = useTranslations("Player");
  const ids = readQuestionIds(number);

  return (
    <div className="@container flex items-center gap-4">
      <a
        className="flex w-full flex-1 shrink-0 scroll-mt-44 ring-0 outline-none"
        href={`#${ids.anchor}`}
        id={ids.anchor}
      >
        <div className="border-primary bg-secondary text-secondary-foreground flex size-9 items-center justify-center rounded-full border">
          <span className="font-mono text-xs tracking-tighter">{number}</span>
          <h2 className="sr-only" id={ids.title}>
            {t("question", { number })}
          </h2>
        </div>
      </a>
      {children}
    </div>
  );
}

/**
 * The prompt of one question, under its head. The card holds every inset, so the document inside draws
 * flush.
 */
export function PlayerQuestionPrompt({ children }: { children: ReactNode }) {
  return <section className="my-6">{children}</section>;
}

/** The answer of one question, under its prompt: its options, or its fields. */
export function PlayerQuestionAnswer({ children }: { children: ReactNode }) {
  return <section className="my-8">{children}</section>;
}
