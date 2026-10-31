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

/**
 * The paper's frame around every screen of a sitting that holds no paper: its entry, its waiting, its outcome,
 * and the moment before the paper arrives, so the whole sitting stands in one full screen under one bar, as a
 * try-out does, and the frame never changes on the way into the paper or out of it.
 */
export function PaperFrame({
  children,
  title,
}: {
  /** The screen under the bar, where the paper's questions stand; none while the paper is on its way. */
  readonly children?: ReactNode;
  readonly title: string;
}) {
  const mode = useSittingMode();

  return (
    <PlayerProvider keys={[]} mode={mode}>
      <PaperBar back={<PaperBack />} title={title} />
      <PlayerMain navigator={null}>{children}</PlayerMain>
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
    <PaperFrame title={t("sitting")}>
      {quiet ? null : <SittingRetry error={error} />}
    </PaperFrame>
  );
}
