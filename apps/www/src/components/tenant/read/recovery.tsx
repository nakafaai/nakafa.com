import { useTimeout } from "@mantine/hooks";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { type ComponentType, type ReactNode, useState } from "react";
import { SittingRetry } from "@/components/exams/sitting/retry";
import { isLostAccess } from "@/components/tenant/refusal";

/** How long the first return to the screen waits, in milliseconds; each failure in a row waits one more of these. */
const RETURN_STEP_MILLISECONDS = 1500;

/** The failures in a row after which the viewer is told, because the server is no longer failing for a moment. */
const QUIET_FAILURES = 4;

/** How long a screen stands before its failures stop counting as a row, in milliseconds. */
const STEADY_MILLISECONDS = 60_000;

/**
 * Keeps a server failure of one read from taking a live screen away. A sitting's reads throw a failure that names no
 * refusal, such as a function that ran out of time, and the screen unmounts with them, so a return reads them again.
 * `frame` stands in for the screen, and the screen comes back by itself. Failures in a row wait longer, and after a
 * few the frame says so with a retry. A lost access is not this boundary's, and goes on to the school's.
 */
export function ReadRecovery({
  children,
  frame: Frame,
}: {
  readonly children: ReactNode;
  /** What stands in for the screen, around what the boundary has to say. */
  readonly frame: ComponentType<{ readonly children: ReactNode }>;
}) {
  const [failures, setFailures] = useState(0);
  const steady = useTimeout(() => setFailures(0), STEADY_MILLISECONDS);

  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <Frame>
          <ReadReturn
            error={error}
            failures={failures}
            onReturn={resetErrorBoundary}
          />
        </Frame>
      )}
      onError={() => {
        setFailures((count) => count + 1);
        steady.clear();
        steady.start();
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

/** The return to the screen: nothing to say until the failures run on, and then the retry. */
function ReadReturn({
  error,
  failures,
  onReturn,
}: {
  readonly error: unknown;
  readonly failures: number;
  readonly onReturn: () => void;
}) {
  const quiet = failures < QUIET_FAILURES;
  useTimeout(onReturn, failures * RETURN_STEP_MILLISECONDS, {
    autoInvoke: quiet,
  });

  if (isLostAccess(error)) {
    throw error;
  }

  return quiet ? null : <SittingRetry error={error} />;
}
