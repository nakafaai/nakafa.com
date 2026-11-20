import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "cn";
import type { ReactNode } from "react";
import { Activity } from "react";
import { useTranslations } from "use-intl";
import { readQuestionIds } from "@/components/player/ids";
import type { PlayerVerdict } from "@/components/player/model";
import { usePlayer } from "@/components/player/provider";
import {
  PlayerVerdictMark,
  VERDICT_VARIANT,
  verdictNumberVariants,
} from "@/components/player/verdict";

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
 * at the start, which links to the question itself, and the question's actions at the end. The link is the
 * circle alone, so its press area never runs under the question's flag or actions. A reviewed question's
 * circle shows its verdict as its number in the navigator does, its color and its corner mark, so no badge
 * says it in words. The number names the question, and its verdict, for a screen reader through its heading.
 */
export function PlayerQuestionHeader({
  children,
  number,
  verdict,
}: {
  /** The question's actions, at the end of the row. */
  children?: ReactNode;
  number: number;
  /** How a reviewed question went; a question still answered has none. */
  verdict?: PlayerVerdict;
}) {
  const tCommon = useTranslations("Common");
  const tPlayer = useTranslations("Player");
  const ids = readQuestionIds(number);

  return (
    <div className="@container flex items-center justify-between gap-4">
      <a
        className={cn(
          "flex size-9 shrink-0 scroll-mt-44 items-center justify-center rounded-full font-mono text-xs tracking-tighter outline-none",
          verdict === undefined
            ? "border-primary bg-secondary text-secondary-foreground border"
            : cn(
                buttonVariants({ variant: VERDICT_VARIANT[verdict] }),
                verdictNumberVariants({ verdict }),
                "size-9 rounded-full px-0"
              )
        )}
        href={`#${ids.anchor}`}
        id={ids.anchor}
      >
        {number}
        <h2 className="sr-only" id={ids.title}>
          {verdict === undefined
            ? tCommon("question", { number })
            : tPlayer("cell-verdict", { number, state: verdict })}
        </h2>
        {verdict === undefined ? null : <PlayerVerdictMark verdict={verdict} />}
      </a>
      {children}
    </div>
  );
}

/**
 * The prompt of one question, under its head. The card holds every inset, so the document inside draws
 * flush.
 */
export function PlayerQuestionPrompt({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn("my-6", className)}>{children}</section>;
}

/** The answer of one question, under its prompt: its options, or its fields. */
export function PlayerQuestionAnswer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn("my-8", className)}>{children}</section>;
}
