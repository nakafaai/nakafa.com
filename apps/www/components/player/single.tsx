"use client";

import { Activity, useLayoutEffect, useRef } from "react";
import { usePlayer, usePlayerView } from "@/components/player/context";
import { PlayerArticle } from "@/components/player/question";

/**
 * Shows one question at a time. Hidden questions stay mounted inside
 * Activity, so drafts survive and switching is instant; the server renders
 * only the current one.
 */
export function PlayerSingle() {
  const questions = usePlayer((session) => session.state.questions);
  const current = usePlayerView((view) => view.current);
  const jump = usePlayerView((view) => view.jump);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!jump) {
      return;
    }
    window.scrollTo({ behavior: "instant", top: 0 });
    ref.current
      ?.querySelector<HTMLElement>(
        `[data-player-key="${CSS.escape(jump.key)}"]`
      )
      ?.focus({ preventScroll: true });
  }, [jump]);

  return (
    <div ref={ref}>
      {questions.map((question) => (
        <Activity
          key={question.key}
          mode={question.key === current ? "visible" : "hidden"}
        >
          <PlayerArticle question={question} />
        </Activity>
      ))}
    </div>
  );
}
