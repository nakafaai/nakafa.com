import { untilPageSettled } from "@repo/design-system/lib/settle";
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
 * Renders its children once the page has loaded and the browser has an idle
 * moment after it, and `fallback` until then. Motion that no first frame needs
 * waits here, such as a page's toys: its work at load would hold back the
 * page's own first frames and its first press.
 */
export function AfterPageSettled({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return usePageSettled() ? children : fallback;
}
