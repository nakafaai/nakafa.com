import { MAX_DOCUMENT_DEPTH } from "@nakafa/aksara-contracts/assessment/document";
import type { Id } from "@repo/backend/confect/_generated/id";
import { MAX_STEP_BYTES } from "@repo/backend/confect/editor/batch";
import { MAX_DOCUMENT_BYTES } from "@repo/backend/confect/editor/size";
import { Collab } from "@repo/design-system/components/editor/collab";
import { slashCommand } from "@repo/design-system/components/editor/command";
import { depthGuard } from "@repo/design-system/components/editor/depth";
import type { DocumentEditorInstance } from "@repo/design-system/components/editor/document";
import { articleProse } from "@repo/design-system/components/editor/prose";
import {
  documentSizeGuard,
  stepSizeGuard,
} from "@repo/design-system/components/editor/size";
import { toast } from "@repo/design-system/lib/toast/notify";
import type { Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { useConvex } from "convex/react";
import { Effect, Fiber, Option, Ref } from "effect";
import { sendableSteps } from "prosemirror-collab";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { type StoreApi, useStore } from "zustand";
import { RICH_EXTENSIONS } from "@/components/tenant/exams/extensions";
import { isLocked } from "@/components/tenant/exams/freeze";
import { refusePaste } from "@/components/tenant/exams/picture";
import { usePageDocument } from "@/components/tenant/exams/preview";
import { useExam, useExamLive } from "@/components/tenant/exams/provider";
import { ExamReadBoundary } from "@/components/tenant/exams/read";
import { ExamDocumentWiringProvider } from "@/components/tenant/exams/rich";
import { ExamSteps } from "@/components/tenant/exams/steps";
import {
  createPromptSync,
  type PromptSync,
} from "@/components/tenant/exams/sync";
import { reportClientException } from "@/lib/analytics/client";
import { closeEditor } from "@/lib/editor/close";
import { convexTransport } from "@/lib/editor/convex";
import { useDocumentLabels } from "@/lib/editor/labels";
import { versionOf, viewPort } from "@/lib/editor/port";
import { reportDropped } from "@/lib/editor/report";
import type { SyncSession } from "@/lib/editor/session";
import { FOLD_RETRY, startSync, tickThroughFold } from "@/lib/editor/sync";

/** The quiet period after a local change, before the editor sends its own steps. */
const SEND_QUIET_PERIOD = "250 millis";

/** Where the text reports its failures and the steps it lost. */
const SOURCE = "components/tenant/exams/text";

/**
 * The extensions of a question's rich text, the prompt, the rubric, or the explanation: the shared
 * assessment document, its collab plugin (the session's client ID comes with the document when it
 * opens), the classes of the published article's text, and the bounds the server folds with,
 * so the editor refuses what the server would refuse.
 */
const TEXT_EXTENSIONS = [
  ...RICH_EXTENSIONS,
  Collab.configure({ clientId: "", version: 0 }),
  articleProse,
  depthGuard(MAX_DOCUMENT_DEPTH),
  stepSizeGuard(MAX_STEP_BYTES, refusePaste),
  documentSizeGuard(MAX_DOCUMENT_BYTES, refusePaste),
];

/**
 * Replaces the round that the editor waits for with `round`, and interrupts the one it
 * replaces. An editor waits for one round at a time, so the retries of a fold never multiply.
 */
const replaceWaiting = (
  waiting: { current: Fiber.Fiber<void> | null },
  round: Effect.Effect<void>
) => {
  const previous = waiting.current;
  waiting.current = Effect.runFork(round);
  if (previous !== null) {
    Effect.runFork(Fiber.interrupt(previous));
  }
};

/**
 * One sync round of the text. A round that meets a fold waits for it: the batch stays unsent
 * under its id, and `tickThroughFold` runs the round again, so the editor shows no failure
 * while the fold runs (ADR 0028). The waiting ends when the server takes the batch, when the
 * round is replaced, or when the text closes, and the closing flush takes over the steps that
 * are left. The steps it lost are reported, and a failure shows the action-error toast. A round
 * that meets a closed editor has nothing left to tell.
 */
const runRound = (
  session: SyncSession | null,
  view: EditorView | null,
  sync: StoreApi<PromptSync>
) => {
  if (session === null || view === null) {
    return Effect.void;
  }
  return tickThroughFold(session, FOLD_RETRY, (dropped) =>
    reportDropped(dropped, SOURCE).pipe(
      Effect.andThen(
        Effect.sync(() => sync.getState().advance(versionOf(view)))
      )
    )
  ).pipe(
    // The retries of FOLD_RETRY end only when the batch lands or the fiber is interrupted, so this
    // handler keeps the round's error type exact and never shows a fold as a failure.
    Effect.catchTags({
      EditorClosed: () => Effect.void,
      SyncFolding: () => Effect.void,
    }),
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
    )
  );
};

/** The props of one rich text of a question. */
interface ExamTextProps {
  /** The rich text the caller composes, an `ExamDocument` with its name, its hint and its size. */
  readonly children: ReactNode;
  /** The document the text edits, which the question owns. */
  readonly documentId: Id<"editorDocuments">;
  /** Called once with the editor, when the server has opened the document and the text takes changes. */
  readonly onOpen?: (editor: DocumentEditorInstance) => void;
}

/**
 * One rich text of a question, edited together with the other editors of the question and synced
 * through the server (ADR 0028). It serves the prompt, the rubric, and the explanation alike. It is
 * read-only until the server opens the document, and it stays read-only once the exam is frozen. A
 * local change schedules a round after `SEND_QUIET_PERIOD`, and the server's steps arrive through a
 * subscription, so the editor takes them without polling. When the text closes, the round it waits
 * for stops, and the steps the editor holds are sent. The text wires the document the caller composes.
 * Until the server opens the document the editor holds nothing, so the text the server holds is drawn
 * in its place, and a text with words never shows empty or as its hint on the way to its editor.
 */
export function ExamText({ children, documentId, onOpen }: ExamTextProps) {
  const { exam, gone, slug } = useExam();
  const frozen = isLocked(exam);
  const labels = useDocumentLabels();
  const extensions = useMemo(
    () => [
      ...TEXT_EXTENSIONS,
      slashCommand({ label: labels.insert, labels: labels.slash }),
    ],
    [labels]
  );
  const convex = useConvex();
  const [sync] = useState(createPromptSync);
  const show = useExamLive((state) => state.show);
  const opened = useStore(sync, (state) => state.clientId !== null);
  const stored = usePageDocument({
    documentId,
    editing: false,
    open: false,
    read: !opened,
    saved: true,
  });
  // An empty text has nothing to draw, and its editor shows the hint at once.
  const drawn = !(
    opened ||
    Option.exists(
      stored,
      (doc) =>
        doc.childCount === 1 &&
        doc.firstChild?.isTextblock === true &&
        doc.firstChild.childCount === 0
    )
  );
  const session = useRef<SyncSession | null>(null);
  const view = useRef<EditorView | null>(null);
  // The fiber that opens the document, and the fiber of the round that the editor waits for: the
  // quiet period after a change, or the next try of a round that met a fold.
  const opening = useRef<Fiber.Fiber<void> | null>(null);
  const waiting = useRef<Fiber.Fiber<void> | null>(null);
  // The editor once it exists, and whether the exam is gone, which a late answer of the server reads.
  const held = useRef<DocumentEditorInstance | null>(null);
  const closed = useRef(gone);

  // An exam gone while its text is open keeps the words on screen: the editor takes the lock in place, and the
  // round it waits for stops, since the server takes nothing more for it.
  useEffect(() => {
    closed.current = gone;
    if (!gone) {
      return;
    }
    held.current?.setEditable(false, false);
    const round = waiting.current;
    if (round !== null) {
      Effect.runFork(Fiber.interrupt(round));
    }
  }, [gone]);

  // A page that closes sends what the editor holds at once, and asks first while the server does not hold it yet,
  // since the send may not leave in time.
  useEffect(() => {
    const flush = () => {
      replaceWaiting(waiting, runRound(session.current, view.current, sync));
    };
    const askFirst = (event: BeforeUnloadEvent) => {
      const editor = view.current;
      if (editor !== null && sendableSteps(editor.state) !== null) {
        flush();
        event.preventDefault();
      }
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", askFirst);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", askFirst);
    };
  }, [sync]);

  // The text closes: stop the open and the waiting round, then send what the editor holds, unless the exam is
  // gone and the server takes nothing more.
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
            current === null || editor === null || closed.current
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

  /**
   * Opens the document for the session, then turns editing on once the server answered, unless
   * the exam is frozen.
   */
  const open = (editor: DocumentEditorInstance) => {
    held.current = editor;
    view.current = editor.view;
    opening.current = Effect.runFork(
      startSync(
        viewPort(editor.view),
        convexTransport(convex, { documentId, slug })
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
            show(documentId, editor.view.state.doc);
            editor.setEditable(!(frozen || closed.current));
            onOpen?.(editor);
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
   * editor made. The changes the server brought in schedule none, and so does a change that
   * edits no text, such as the editor taking its lock.
   */
  const change = (transaction: Transaction) => {
    show(documentId, transaction.doc);
    if (
      !transaction.docChanged ||
      transaction.getMeta("rebased") !== undefined
    ) {
      return;
    }
    replaceWaiting(
      waiting,
      Effect.sleep(SEND_QUIET_PERIOD).pipe(
        Effect.andThen(
          Effect.suspend(() => runRound(session.current, view.current, sync))
        )
      )
    );
  };

  return (
    <ExamDocumentWiringProvider
      extensions={extensions}
      onChange={change}
      onEditor={open}
      opening={drawn}
      stored={stored}
    >
      {children}
      <ExamReadBoundary>
        <ExamSteps
          documentId={documentId}
          onSteps={() =>
            replaceWaiting(
              waiting,
              runRound(session.current, view.current, sync)
            )
          }
          sync={sync}
        />
      </ExamReadBoundary>
    </ExamDocumentWiringProvider>
  );
}
