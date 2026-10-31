import { useEffect, useEffectEvent, useRef } from "react";

/** Marks a control drawn on the server whose press must not be lost before React takes the page over. */
export const PRESS_ATTRIBUTE = "data-press";

/** Set by the app's pre-paint script on such a control when it is pressed, until React replays the press. */
export const PRESSED_ATTRIBUTE = "data-pressed";

/**
 * The props of a control drawn on the server that answers its own presses, whose
 * press must not be lost before React takes the page over, as the app's
 * pre-paint script keeps it. Spread them on the control. `data-press` lets that script mark the
 * pressed control, and when React mounts it, a marked control loses its mark and
 * runs `onPress`. After that `onClick` clears the mark that the script sets on
 * every press. The mark is an attribute React did not render, so the control
 * hydrates with `suppressHydrationWarning`.
 */
export function useMissedPress<Control extends HTMLElement>(
  onPress: () => void
) {
  const ref = useRef<Control>(null);
  const replay = useEffectEvent(() => {
    const control = ref.current;
    if (control === null || !control.hasAttribute(PRESSED_ATTRIBUTE)) {
      return;
    }
    control.removeAttribute(PRESSED_ATTRIBUTE);
    onPress();
  });

  useEffect(() => {
    replay();
  }, []);

  return {
    [PRESS_ATTRIBUTE]: "",
    onClick() {
      ref.current?.removeAttribute(PRESSED_ATTRIBUTE);
    },
    ref,
    suppressHydrationWarning: true,
  };
}

/**
 * The props of a control drawn on the server whose press runs `onPress`, as
 * `useMissedPress` keeps it, and whose `onClick` runs it once React holds the page.
 */
export function useEarlyPress<Control extends HTMLElement>(
  onPress: () => void
) {
  const missed = useMissedPress<Control>(onPress);

  return {
    ...missed,
    onClick() {
      missed.onClick();
      onPress();
    },
  };
}
