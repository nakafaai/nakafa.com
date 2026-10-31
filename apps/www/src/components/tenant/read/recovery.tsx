import { useTimeout } from "@mantine/hooks";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { useLocation } from "@tanstack/react-router";
import { type ComponentType, Fragment, type ReactNode, useState } from "react";
import { isLostAccess } from "@/components/tenant/refusal";
import { isStaleChunkError } from "@/lib/chunks/stale";

/** How long the first return to the screen waits, in milliseconds; each failure in a row waits one more of these. */
const RETURN_STEP_MILLISECONDS = 1500;

/** The failures in a row after which the viewer is told, because the server is no longer failing for a moment. */
const QUIET_FAILURES = 4;

/** How long a screen stands before its failures stop counting as a row, in milliseconds. */
const STEADY_MILLISECONDS = 60_000;

/**
 * Keeps a server failure of one read from taking a live screen away. A read throws a failure that names no refusal,
 * such as a function that ran out of time, and the screen unmounts with it, so a return reads it again. `frame` stands
 * in for the screen, and the screen comes back by itself. Failures in a row wait longer, and after a few `retry`
 * takes over. A lost access is not this boundary's and goes on to the school's, and so does a chunk of an earlier
 * deploy, which only a new document brings back.
 */
export function ReadRecovery({
  children,
  frame: Frame,
  resetKeys,
  retry: Retry,
}: {
  readonly children: ReactNode;
  /** What stands in for the screen, around what the boundary has to say. */
  readonly frame: ComponentType<{ readonly children: ReactNode }>;
  /** What brings the screen back at once when one of them changes, such as the page's address. */
  readonly resetKeys?: readonly unknown[];
  /** What shows once the failures run on. */
  readonly retry: ComponentType<{ readonly error: unknown }>;
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
          {failures < QUIET_FAILURES ? null : <Retry error={error} />}
        </Frame>
      )}
      onError={() => {
        setFailures((count) => count + 1);
        steady.clear();
        steady.start();
      }}
      resetKeys={resetKeys === undefined ? undefined : [...resetKeys]}
    >
      {children}
    </ErrorBoundary>
  );
}

/** The return to the screen, which draws nothing and stops once the failures run on. */
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

  if (isLostAccess(error) || isStaleChunkError(error)) {
    throw error;
  }

  return null;
}

/** Hands a failure that keeps coming to the school's own boundary, which offers a new document. */
function PassOn({ error }: { readonly error: unknown }): null {
  throw error;
}

/**
 * Keeps a server failure of one read inside the school: the shell stays around the page, and the page comes back by
 * itself, which every page of the school takes without a boundary of its own. A new address brings a page at once.
 */
export function PageRecovery({ children }: { readonly children: ReactNode }) {
  const address = useLocation({ select: (location) => location.pathname });

  return (
    <ReadRecovery frame={Fragment} resetKeys={[address]} retry={PassOn}>
      {children}
    </ReadRecovery>
  );
}
