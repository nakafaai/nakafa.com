import { captureException } from "@repo/analytics/posthog/capture";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { Effect, Fiber } from "effect";
import { type ReactNode, useEffect } from "react";
import { isLostAccess } from "@/components/tenant/refusal";

/** How long a read that failed waits before it runs again. */
const READ_AGAIN = "3 seconds";

/**
 * Keeps a failed read away from what the teacher is writing. A read throws a failure that names no refusal, such as
 * a function that ran out of time, and without this boundary the page's own would take every editor off the screen
 * and draw the empty frame in their place. Here only the part that read fails: `stand` holds its place, the teacher
 * keeps writing, and the read runs again by itself. A viewer who lost the school goes on to the school's boundary.
 */
export function ExamReadBoundary({
  children,
  stand = null,
}: {
  readonly children: ReactNode;
  /** What holds the part's place while its read waits to run again. */
  readonly stand?: ReactNode;
}) {
  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <>
          <ExamReadAgain error={error} onAgain={resetErrorBoundary} />
          {stand}
        </>
      )}
      onError={(error, info) => {
        // A viewer who lost the school is shown so by the school's own boundary, which is no failure.
        if (isLostAccess(error)) {
          return;
        }
        captureException(error, {
          component_stack: info.componentStack,
          source: "react-error-boundary",
        });
      }}
      report={false}
    >
      {children}
    </ErrorBoundary>
  );
}

/** Waits, then runs the read again: the failed reader is gone, so the server runs it once more. */
function ExamReadAgain({
  error,
  onAgain,
}: {
  error: unknown;
  onAgain: () => void;
}) {
  useEffect(() => {
    const wait = Effect.runFork(
      Effect.sleep(READ_AGAIN).pipe(Effect.andThen(Effect.sync(onAgain)))
    );
    return () => {
      Effect.runFork(Fiber.interrupt(wait));
    };
  }, [onAgain]);
  if (isLostAccess(error)) {
    throw error;
  }
  return null;
}
