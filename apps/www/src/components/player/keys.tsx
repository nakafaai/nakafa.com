"use client";

import { useWindowEvent } from "@mantine/hooks";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { Array as Arr, Option } from "effect";
import {
  pickOption,
  readKeyTarget,
  readPlayerKey,
} from "@/components/player/keyboard";
import type { PlayerQuestionModel } from "@/components/player/model";
import {
  focusNavigator,
  focusQuestion,
  isFocusInNavigator,
} from "@/components/player/navigator/focus";
import { usePlayer } from "@/components/player/provider";

/**
 * Opens or closes the navigator. It is a sheet on a small screen, so the key
 * opens and closes it. From the large breakpoint it is a column that is always
 * open, so the key moves focus into it, and back out to the question.
 */
function useNavigatorToggle() {
  const current = usePlayer((state) => state.current);
  const overlay = usePlayer((state) => state.overlay);
  const close = usePlayer((state) => state.close);
  const open = usePlayer((state) => state.open);

  return function toggle() {
    if (overlay === "navigator") {
      close();
    } else if (!window.matchMedia(TAILWIND_MEDIA_QUERIES.lgAndUp).matches) {
      open("navigator");
    } else if (isFocusInNavigator()) {
      focusQuestion(current);
    } else {
      focusNavigator();
    }
  };
}

/**
 * Binds the player keys to the window: the arrows step, `1` to `5` pick an
 * option of a single-choice question, and `G` opens and closes the navigator.
 */
export function PlayerKeys({
  locked,
  questions,
}: {
  /** Answers are read-only because time ran out. */
  locked: boolean;
  questions: readonly PlayerQuestionModel[];
}) {
  const current = usePlayer((state) => state.current);
  const overlay = usePlayer((state) => state.overlay);
  const step = usePlayer((state) => state.step);
  const toggleNavigator = useNavigatorToggle();

  useWindowEvent("keydown", (event) => {
    const intent = readPlayerKey(event, {
      ...readKeyTarget(event.target),
      locked,
      overlay,
    });
    if (Option.isNone(intent)) {
      return;
    }
    const action = intent.value;
    if (action.kind === "step") {
      event.preventDefault();
      step(action.delta);
    } else if (action.kind === "navigator") {
      event.preventDefault();
      toggleNavigator();
    } else {
      const picked = Option.flatMap(
        Arr.findFirst(questions, (question) => question.key === current),
        (question) =>
          Option.map(
            pickOption(question.responseSpec, action.index),
            (selection) => ({ question, selection })
          )
      );
      if (Option.isSome(picked)) {
        event.preventDefault();
        picked.value.question.answer(picked.value.selection);
      }
    }
  });

  return null;
}
