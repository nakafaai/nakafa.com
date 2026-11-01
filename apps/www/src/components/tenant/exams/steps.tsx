import { QueryResult, useQuery } from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import editors from "@repo/backend/confect/_generated/refs/editor";
import { useEffect, useEffectEvent } from "react";
import { type StoreApi, useStore } from "zustand";
import { useExam } from "@/components/tenant/exams/provider";
import type { PromptSync } from "@/components/tenant/exams/sync";

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
