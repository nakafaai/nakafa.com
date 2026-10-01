"use client";

import { usePlayerView } from "@/components/player/context";
import { PlayerList } from "@/components/player/list";
import { PlayerSingle } from "@/components/player/single";

/** Renders the questions in the view the learner chose. */
export function PlayerQuestions() {
  const mode = usePlayerView((view) => view.mode);
  if (mode === "single") {
    return <PlayerSingle />;
  }
  return <PlayerList />;
}
