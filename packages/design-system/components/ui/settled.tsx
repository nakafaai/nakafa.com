import { untilPageRead, untilPageSettled } from "@repo/design-system/lib/settle";
import { Effect, Fiber } from "effect";
import { type ReactNode, useEffect, useState } from "react";

/**
 * Whether the page has loaded and the browser has had an idle moment after
 * it. Motion that no first frame needs starts once this is true.
 */
export function usePageSettled() {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const waiting = Effect.runFork(
      untilPageSettled.pipe(Effect.andThen(Effect.sync(() => setSettled(true))))
    );
    return () => {
      Effect.runFork(Fiber.interrupt(waiting));
    };
  }, []);

  return settled;
}

/**
 * Renders its children once the page has its reader (`untilPageRead`), and nothing
 * until then. Decoration waits here, such as a page's toys and particles: its work
 * would hold back the page's own first frames and its first press.
 */
export function AfterPageRead({ children }: { children: ReactNode }) {
  const [read, setRead] = useState(false);

  useEffect(() => {
    const waiting = Effect.runFork(
      untilPageRead.pipe(Effect.andThen(Effect.sync(() => setRead(true))))
    );
    return () => {
      Effect.runFork(Fiber.interrupt(waiting));
    };
  }, []);

  return read ? children : null;
}
