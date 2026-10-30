import { useEffect, useEffectEvent, useRef } from "react";
import { PRESS_ATTRIBUTE, PRESSED_ATTRIBUTE } from "@/lib/press/prepaint";

/**
 * The props of a control drawn on the server whose press must not be lost
 * before React takes the page over (`EARLY_PRESS_SCRIPT`). Spread them on the
 * control. `data-press` lets the pre-paint script mark the pressed control, and
 * when React mounts it, a marked control loses its mark and runs `onPress`.
 * After that `onClick` runs `onPress` itself and clears the mark that the script
 * sets on every press. The mark is an attribute React did not render, so the
 * control hydrates with `suppressHydrationWarning`.
 */
export function useEarlyPress<Control extends HTMLElement>(
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
      onPress();
    },
    ref,
    suppressHydrationWarning: true,
  };
}
