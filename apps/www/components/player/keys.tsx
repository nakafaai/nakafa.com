"use client";

import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { Option } from "effect";
import { useEffect, useEffectEvent } from "react";
import { usePlayer, usePlayerView } from "@/components/player/context";
import { readKeyTarget, readPlayerKey } from "@/components/player/keyboard";
import { focusPlayerSidebar } from "@/components/player/navigator/focus";

/**
 * Binds the player shortcuts to the document: arrows step, F flags, 1 to 5
 * pick an option, and G opens or focuses the navigator.
 */
export function PlayerKeys() {
  const session = usePlayer((value) => value);
  const current = usePlayerView((view) => view.current);
  const open = usePlayerView((view) => view.open);
  const overlay = usePlayerView((view) => view.overlay);
  const step = usePlayerView((view) => view.step);

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const intent = readPlayerKey(event, {
      ...readKeyTarget(event.target),
      locked: session.state.locked,
      overlay: overlay !== "none",
    });
    if (Option.isNone(intent)) {
      return;
    }
    const question = session.state.questions.find(
      (candidate) => candidate.key === current
    );
    if (intent.value.kind === "step") {
      event.preventDefault();
      step(intent.value.delta);
      return;
    }
    if (intent.value.kind === "navigator") {
      event.preventDefault();
      if (!window.matchMedia(TAILWIND_MEDIA_QUERIES.lgAndUp).matches) {
        open("navigator");
        return;
      }
      focusPlayerSidebar();
      return;
    }
    if (!question) {
      return;
    }
    if (intent.value.kind === "flag") {
      event.preventDefault();
      question.flag(!question.flagged);
      return;
    }
    const pick = session.meta.responses[question.responseSpec.kind].pick;
    const selection = pick ? pick(question, intent.value.index) : Option.none();
    if (Option.isSome(selection)) {
      event.preventDefault();
      question.answer(selection.value);
    }
  });

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
