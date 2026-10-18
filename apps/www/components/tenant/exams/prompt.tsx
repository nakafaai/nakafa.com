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
import { articleParagraphs } from "@repo/design-system/components/editor/paragraph";
import {
  documentSizeGuard,
  stepSizeGuard,
} from "@repo/design-system/components/editor/size";
import { toast } from "@repo/design-system/lib/toast/notify";
import { documentExtensions } from "@repo/editor/document";
import type { Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { useConvex } from "convex/react";
import { Effect, Fiber, Ref } from "effect";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { type StoreApi, useStore } from "zustand";
import { useExamLive } from "@/components/tenant/exams/provider";
import {
  createPromptSync,
  type PromptSync,
} from "@/components/tenant/exams/sync";
import { reportClientException } from "@/lib/analytics/client";
import { closeEditor } from "@/lib/editor/close";
import { convexTransport } from "@/lib/editor/convex";
import { versionOf, viewPort } from "@/lib/editor/port";
import { reportDropped } from "@/lib/editor/report";
import type { SyncSession } from "@/lib/editor/session";
import { startSync, tick } from "@/lib/editor/sync";

/** The quiet period after a local change, before the editor sends its own steps. */
const SEND_QUIET_PERIOD = "250 millis";

/** Where the prompt reports its failures and the steps it lost. */
const SOURCE = "components/tenant/exams/prompt";

/**
 * The extensions of a question's prompt: the assessment document of the contract, its
 * collab plugin (the session's client ID comes with the document when it opens), the classes
 * of the published article's paragraphs, and the bounds the server folds with, so the editor
 * refuses what the server would refuse.
 */
const PROMPT_EXTENSIONS = [
  ...documentExtensions(ASSESSMENT_RULES),
  Collab.configure({ clientId: "", version: 0 }),
  articleParagraphs,
  depthGuard(MAX_DOCUMENT_DEPTH),
  stepSizeGuard(MAX_STEP_BYTES),
  documentSizeGuard(MAX_DOCUMENT_BYTES),
];

/**
 * One sync round of the prompt, which runs to its end even when the prompt closes, so the
 * loop is never left half done. The steps it lost are reported, and a failure shows the
 * action-error toast. A round that meets a closed editor has nothing left to tell.
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
    Effect.tap((dropped) => reportDropped(dropped, SOURCE)),
    Effect.andThen(Effect.sync(() => sync.getState().advance(versionOf(view)))),
    Effect.catchTag("EditorClosed", () => Effect.void),
    Effect.catch((error) =>
      reportClientException(error, { source: SOURCE }).pipe(
        Effect.andThen(
          Effect.sync(() =>
            toast.error({
              description: "action-error.description",
              title: "action-error.title",
            })
          )
        )
      )
    ),
    Effect.uninterruptible
  );
};

/**
 * The prompt of one question: the document the teacher writes, edited together with the
 * other editors of the question and synced through the server (ADR 0028). It is read-only
 * until the server opens the document. A local change schedules a round after
 * `SEND_QUIET_PERIOD`, and the server's steps arrive through a subscription, so the editor
 * takes them without polling. When the prompt closes, the round it waits for stops, and the
 * steps the editor holds are sent.
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
  const show = useExamLive((state) => state.show);
  const clientId = useStore(sync, (state) => state.clientId);
  const version = useStore(sync, (state) => state.version);
  const reply = useQuery(
    editors.steps.since,
    clientId === null ? "skip" : { clientId, documentId: prompt, slug, version }
  );
  const session = useRef<SyncSession | null>(null);
  const view = useRef<EditorView | null>(null);
  // The fiber that opens the document, and the fiber of the round that waits for the quiet period.
  const opening = useRef<Fiber.Fiber<void> | null>(null);
  const waiting = useRef<Fiber.Fiber<void> | null>(null);

  // A `behind` reply makes the round reopen the document from its snapshot, so it starts one too.
  useEffect(() => {
    if (
      QueryResult.isSuccess(reply) &&
      (reply.value._tag === "behind" ||
        (reply.value._tag === "steps" && reply.value.steps.length > 0))
    ) {
      Effect.runFork(runRound(session.current, view.current, sync));
    }
  }, [reply, sync]);

  // The prompt closes: stop the open and the waiting round, then send what the editor holds.
  useEffect(
    () => () => {
      const current = session.current;
      const editor = view.current;
      Effect.runFork(
        Effect.forEach(
          [opening.current, waiting.current],
          (fiber) => (fiber === null ? Effect.void : Fiber.interrupt(fiber)),
          { discard: true }
        ).pipe(
          Effect.andThen(
            current === null || editor === null
              ? Effect.void
              : closeEditor(
                  current,
                  Effect.sync(() => editor.state),
                  SOURCE
                )
          )
        )
      );
    },
    []
  );

  /** Opens the document for the session, then turns editing on once the server answered. */
  const open = (editor: {
    readonly view: EditorView;
    setEditable: (on: boolean) => unknown;
  }) => {
    view.current = editor.view;
    opening.current = Effect.runFork(
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
        Effect.tap(() =>
          Effect.sync(() => {
            show(prompt, editor.view.state.doc);
            editor.setEditable(true);
          })
        ),
        Effect.catchTag("EditorClosed", () => Effect.void),
        Effect.catch((error) =>
          reportClientException(error, { source: SOURCE }).pipe(
            Effect.andThen(
              Effect.sync(() =>
                toast.error({
                  description: "action-error.description",
                  title: "action-error.title",
                })
              )
            )
          )
        ),
        Effect.asVoid
      )
    );
  };

  /**
   * Shows every change in the strip's thumbnail, then schedules a round for a change this
   * editor made. The changes the server brought in schedule none.
   */
  const change = (transaction: Transaction) => {
    show(prompt, transaction.doc);
    if (transaction.getMeta("rebased") !== undefined) {
      return;
    }
    const previous = waiting.current;
    waiting.current = Effect.runFork(
      Effect.sleep(SEND_QUIET_PERIOD).pipe(
        Effect.andThen(
          Effect.suspend(() => runRound(session.current, view.current, sync))
        )
      )
    );
    if (previous !== null) {
      Effect.runFork(Fiber.interrupt(previous));
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
