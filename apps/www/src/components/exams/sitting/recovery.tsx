import { useTimeout } from "@mantine/hooks";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { type ReactNode, useState } from "react";
import { useTranslations } from "use-intl";
import { PaperBack, PaperBar } from "@/components/exams/sitting/bar";
import { useSittingMode } from "@/components/exams/sitting/mode";
import { SittingRetry } from "@/components/exams/sitting/retry";
import { PlayerMain } from "@/components/player/frame";
import { PlayerProvider } from "@/components/player/provider";
import { isLostAccess } from "@/components/tenant/refusal";

/** How long the first return to the paper waits, in milliseconds; each failure in a row waits one more of these. */
const RETURN_STEP_MILLISECONDS = 1500;

/** The failures in a row after which the student is told, because the server is no longer failing for a moment. */
const QUIET_FAILURES = 4;

/** How long a paper stands before its failures stop counting as a row, in milliseconds. */
const STEADY_MILLISECONDS = 60_000;

/** The paper's frame while the paper is not on screen: full screen, under its bar, with the paper to come. */
export function PaperFrame({ children }: { readonly children: ReactNode }) {
  const mode = useSittingMode();

  return (
    <PlayerProvider keys={[]} mode={mode}>
      {children}
      <PlayerMain navigator={null}>{null}</PlayerMain>
    </PlayerProvider>
  );
}

/**
 * Keeps a server failure of one read from taking the exam away. The sitting's reads throw a failure that names no
 * refusal, such as a function that ran out of time, and the paper unmounts with them, so a return reads them again.
 * The student stays in the paper's frame and comes back on their own: the page enters by itself, and every typed
 * word waits in the browser. Failures in a row wait longer, and after a few the frame says so with a retry. A lost
 * access is not this boundary's, and goes on to the school's.
 */
export function SittingRecovery({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [failures, setFailures] = useState(0);
  const steady = useTimeout(() => setFailures(0), STEADY_MILLISECONDS);

  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <PaperReturn
          error={error}
          failures={failures}
          onReturn={resetErrorBoundary}
        />
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

/** The frame that stands in for the paper, until it returns or the student is told to try again. */
function PaperReturn({
  error,
  failures,
  onReturn,
}: {
  readonly error: unknown;
  readonly failures: number;
  readonly onReturn: () => void;
}) {
  const t = useTranslations("Exams");
  const quiet = failures < QUIET_FAILURES;
  useTimeout(onReturn, failures * RETURN_STEP_MILLISECONDS, {
    autoInvoke: quiet,
  });

  if (isLostAccess(error)) {
    throw error;
  }

  return (
    <PaperFrame>
      <PaperBar back={<PaperBack />} title={t("sitting")} />
      {quiet ? null : <SittingRetry error={error} />}
    </PaperFrame>
  );
}
