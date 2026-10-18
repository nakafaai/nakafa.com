"use client";

import { QueryResult, useQuery } from "@confect/react";
import { MAX_DOCUMENT_DEPTH } from "@nakafa/aksara-contracts/assessment/document";
import type { Id } from "@repo/backend/confect/_generated/id";
import editors from "@repo/backend/confect/_generated/refs/editor";
import { MAX_STEP_BYTES } from "@repo/backend/confect/editor/batch";
import { ASSESSMENT_RULES } from "@repo/backend/confect/editor/model";
import { MAX_DOCUMENT_BYTES } from "@repo/backend/confect/editor/size";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Collab } from "@repo/design-system/components/editor/collab";
import { depthGuard } from "@repo/design-system/components/editor/depth";
import { DocumentEditor } from "@repo/design-system/components/editor/document";
import {
  documentSizeGuard,
  stepSizeGuard,
} from "@repo/design-system/components/editor/size";
import { toast } from "@repo/design-system/lib/toast/notify";
import { documentExtensions } from "@repo/editor/document";
import type { Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { useConvex } from "convex/react";
import { Effect, Ref } from "effect";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { type StoreApi, useStore } from "zustand";
import {
  createPromptSync,
  type PromptSync,
} from "@/components/tenant/exams/sync";
import { reportClientException } from "@/lib/analytics/client";
import { convexTransport } from "@/lib/editor/convex";
import { versionOf, viewPort } from "@/lib/editor/port";
import type { SyncSession } from "@/lib/editor/session";
import { startSync, tick } from "@/lib/editor/sync";
import { makeQuietSaver } from "@/lib/save/quiet";

/** The quiet period after a local change, before the editor sends its own steps. */
const SEND_QUIET_PERIOD = "250 millis";

/**
 * The extensions of a question's prompt: the assessment document of the contract, its
 * collab plugin (the session's client ID comes with the document when it opens), and the
 * bounds the server folds with, so the editor refuses what the server would refuse.
 */
const PROMPT_EXTENSIONS = [
  ...documentExtensions(ASSESSMENT_RULES),
  Collab.configure({ clientId: "", version: 0 }),
  depthGuard(MAX_DOCUMENT_DEPTH),
  stepSizeGuard(MAX_STEP_BYTES),
  documentSizeGuard(MAX_DOCUMENT_BYTES),
];

/**
 * One sync round of the prompt: the server's steps arrive first, then the editor's own, by
 * the loop's rules. The version the editor holds is then recorded, so the subscription
 * reads the steps after it. A failed round is reported and shows the action-error toast.
 */
const runRound = (
  session: SyncSession | null,
  view: EditorView | null,
  sync: StoreApi<PromptSync>
) => {
  if (session === null || view === null) {
    return Effect.void;
  }
  return tick(session).pipe(
    Effect.andThen(Effect.sync(() => sync.getState().advance(versionOf(view)))),
    Effect.catch((error) =>
      reportClientException(error, {
        source: "components/tenant/exams/prompt",
      }).pipe(
        Effect.andThen(
          Effect.sync(() =>
            toast.error({
              description: "action-error.description",
              title: "action-error.title",
            })
          )
        )
      )
    )
  );
};

/**
 * The prompt of one question: the document the teacher writes, edited together with the
 * other editors of the question and synced through the server (ADR 0028). It is read-only
 * until the server opens the document, and it sends its own steps after a quiet period of
 * `SEND_QUIET_PERIOD`. The server's steps arrive through a subscription, so the editor
 * takes them without polling.
 */
export function ExamPrompt({
  prompt,
  slug,
}: {
  prompt: Id<"editorDocuments">;
  slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  const convex = useConvex();
  const [sync] = useState(createPromptSync);
  const clientId = useStore(sync, (state) => state.clientId);
  const version = useStore(sync, (state) => state.version);
  const reply = useQuery(
    editors.steps.since,
    clientId === null ? "skip" : { clientId, documentId: prompt, slug, version }
  );
  const session = useRef<SyncSession | null>(null);
  const view = useRef<EditorView | null>(null);
  const [saver] = useState(() =>
    Effect.runSync(
      makeQuietSaver((round: Effect.Effect<void>) => round, SEND_QUIET_PERIOD)
    )
  );

  useEffect(() => {
    if (
      QueryResult.isSuccess(reply) &&
      reply.value._tag === "steps" &&
      reply.value.steps.length > 0
    ) {
      Effect.runFork(runRound(session.current, view.current, sync));
    }
  }, [reply, sync]);

  /** Opens the document for the session, then turns editing on once the server answered. */
  const open = (editor: {
    readonly view: EditorView;
    setEditable: (on: boolean) => unknown;
  }) => {
    view.current = editor.view;
    Effect.runFork(
      startSync(
        viewPort(editor.view),
        convexTransport(convex, { documentId: prompt, slug })
      ).pipe(
        Effect.tap((started) =>
          Effect.sync(() => {
            session.current = started;
          })
        ),
        Effect.flatMap((started) => Ref.get(started.memory)),
        Effect.tap((memory) =>
          Effect.sync(() =>
            sync.getState().open(memory.clientId, versionOf(editor.view))
          )
        ),
        Effect.tap(() => Effect.sync(() => editor.setEditable(true))),
        Effect.catch((error) =>
          reportClientException(error, {
            source: "components/tenant/exams/prompt",
          }).pipe(
            Effect.andThen(
              Effect.sync(() =>
                toast.error({
                  description: "action-error.description",
                  title: "action-error.title",
                })
              )
            )
          )
        )
      )
    );
  };

  /** Schedules a round for a change this editor made, and ignores the changes the server brought in. */
  const change = (transaction: Transaction) => {
    if (transaction.getMeta("rebased") === undefined) {
      Effect.runFork(
        saver.touch(runRound(session.current, view.current, sync))
      );
    }
  };

  return (
    <DocumentEditor
      className="min-h-32 outline-none"
      extensions={PROMPT_EXTENSIONS}
      label={t("prompt-label")}
      onChange={change}
      onEditor={open}
      placeholder={t("prompt-placeholder")}
    />
  );
}
