import { QueryResult, useQuery } from "@confect/react";
import { captureException } from "@repo/analytics/posthog/capture";
import type { Id } from "@repo/backend/confect/_generated/id";
import editors from "@repo/backend/confect/_generated/refs/editor";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { Effect, Fiber } from "effect";
import { type ReactNode, useEffect, useEffectEvent } from "react";
import { type StoreApi, useStore } from "zustand";
import { useExam } from "@/components/tenant/exams/provider";
import type { PromptSync } from "@/components/tenant/exams/sync";
import { isLostAccess } from "@/components/tenant/refusal";

/** How long a text goes without the server's steps before it reads them again, after the read failed. */
const READ_AGAIN = "3 seconds";

/**
 * Keeps a failed read of the server's steps away from the text: the teacher keeps the words on screen and
 * keeps writing while the steps stop arriving, and the read runs again by itself. A question's texts each
 * read their steps, again at every version, so this is the read most likely to fail in the editor.
 */
export function ExamStepsBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <ExamStepsAgain error={error} onAgain={resetErrorBoundary} />
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

/** Waits, then reads the steps again: the failed reader is gone, so the server runs the read once more. */
function ExamStepsAgain({
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

/**
 * The server's steps of an open text, through a subscription, so the editor takes them without polling.
 * A `behind` reply makes the round reopen the document from its snapshot, so it starts one too.
 */
export function ExamSteps({
  documentId,
  onSteps,
  sync,
}: {
  /** The document the text edits. */
  documentId: Id<"editorDocuments">;
  /** Called when the server holds what the editor does not, to start a round. */
  onSteps: () => void;
  /** The text's sync store, which names the session and the version it reads from. */
  sync: StoreApi<PromptSync>;
}) {
  const { slug } = useExam();
  const clientId = useStore(sync, (state) => state.clientId);
  const version = useStore(sync, (state) => state.version);
  const reply = useQuery(
    editors.steps.since,
    clientId === null ? "skip" : { clientId, documentId, slug, version }
  );
  const takeSteps = useEffectEvent(onSteps);

  useEffect(() => {
    if (
      QueryResult.isSuccess(reply) &&
      (reply.value._tag === "behind" ||
        (reply.value._tag === "steps" && reply.value.steps.length > 0))
    ) {
      takeSteps();
    }
  }, [reply]);

  return null;
}
