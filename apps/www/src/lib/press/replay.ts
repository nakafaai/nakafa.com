import { useEffect, useEffectEvent, useRef } from "react";
import { PRESS_ATTRIBUTE, PRESSED_ATTRIBUTE } from "@/lib/press/prepaint";

/**
 * The props of a control drawn on the server that answers its own presses, whose
 * press must not be lost before React takes the page over (`EARLY_PRESS_SCRIPT`).
 * Spread them on the control. `data-press` lets the pre-paint script mark the
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
