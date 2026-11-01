import { useTimeout } from "@mantine/hooks";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useState } from "react";

/** How long a popup waits for what it reads before it opens and says it is waiting. */
const HOLD_MILLISECONDS = 1500;

/**
 * Stands in a popup's body while what it reads is on its way. A dialog, a sheet or a drawer that holds one stays unseen
 * over its backdrop, so it shows whole in its first frame instead of filling in. A read that takes too long opens the
 * popup with a spinner in its place, so a slow network never leaves a press without an answer.
 */
export function PopupHold() {
  const [waited, setWaited] = useState(false);
  useTimeout(() => setWaited(true), HOLD_MILLISECONDS, { autoInvoke: true });

  if (waited) {
    return <Spinner className="m-auto" />;
  }
  return <span data-popup-hold="" hidden />;
}
