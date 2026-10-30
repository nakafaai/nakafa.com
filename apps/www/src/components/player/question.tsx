import { Activity, type ReactNode } from "react";
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
