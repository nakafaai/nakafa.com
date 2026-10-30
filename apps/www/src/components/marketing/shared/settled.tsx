import { untilPageSettled } from "@repo/design-system/lib/settle";
import { Effect, Fiber } from "effect";
import { type ReactNode, useEffect, useState } from "react";

/**
 * Renders its children once the page has loaded and the browser has an idle
 * moment after it. A marketing page's toys wait here: they animate, and their
 * work at load would hold back the page's own first frames and its first press.
 */
export function AfterPageSettled({ children }: { children: ReactNode }) {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const waiting = Effect.runFork(
      untilPageSettled.pipe(Effect.andThen(Effect.sync(() => setSettled(true))))
    );
    return () => {
      Effect.runFork(Fiber.interrupt(waiting));
    };
  }, []);

  return settled ? children : null;
}
