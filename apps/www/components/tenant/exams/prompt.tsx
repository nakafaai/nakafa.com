"use client";

import { QueryResult, useAction, useMutation, useQuery } from "@confect/react";
import { MAX_DOCUMENT_DEPTH } from "@nakafa/aksara-contracts/assessment/document";
import type { Id } from "@repo/backend/confect/_generated/id";
import editors from "@repo/backend/confect/_generated/refs/editor";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { MAX_STEP_BYTES } from "@repo/backend/confect/editor/batch";
import { ASSESSMENT_RULES } from "@repo/backend/confect/editor/model";
import { MAX_DOCUMENT_BYTES } from "@repo/backend/confect/editor/size";
import { Collab } from "@repo/design-system/components/editor/collab";
import { slashCommand } from "@repo/design-system/components/editor/command";
import { depthGuard } from "@repo/design-system/components/editor/depth";
import { DocumentEditor } from "@repo/design-system/components/editor/document";
import {
  FORMULA_VIEWS,
  FormulaLabelsProvider,
} from "@repo/design-system/components/editor/formula";
import {
  type ImageRefusal,
  imageRefusal,
} from "@repo/design-system/components/editor/image";
import { articleParagraphs } from "@repo/design-system/components/editor/paragraph";
import {
  PICTURE_VIEW,
  PictureAltDialog,
  PicturesProvider,
  pictureFileHandler,
  useObjectUrl,
} from "@repo/design-system/components/editor/picture";
import {
  documentSizeGuard,
  stepSizeGuard,
} from "@repo/design-system/components/editor/size";
import { DocumentToolbar } from "@repo/design-system/components/editor/toolbar";
import { toast } from "@repo/design-system/lib/toast/notify";
import { documentExtensions } from "@repo/editor/document";
import type { Plugin, Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { useConvex } from "convex/react";
import {
  Array as Arr,
  Effect,
  Fiber,
  Option,
  Record as Rec,
  Ref,
} from "effect";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type StoreApi, useStore } from "zustand";
import { isFrozen } from "@/components/tenant/exams/freeze";
import { storeExamImage } from "@/components/tenant/exams/image.client";
import { useExam, useExamLive } from "@/components/tenant/exams/provider";
import {
  createPromptSync,
  type PromptSync,
} from "@/components/tenant/exams/sync";
import { reportClientException } from "@/lib/analytics/client";
import { closeEditor } from "@/lib/editor/close";
import { convexTransport } from "@/lib/editor/convex";
import { useDocumentLabels } from "@/lib/editor/labels";
import { pictureIdsPlugin } from "@/lib/editor/pictures";
import { versionOf, viewPort } from "@/lib/editor/port";
import { reportDropped } from "@/lib/editor/report";
import type { SyncSession } from "@/lib/editor/session";
import { FOLD_RETRY, startSync, tickThroughFold } from "@/lib/editor/sync";

/** The quiet period after a local change, before the editor sends its own steps. */
const SEND_QUIET_PERIOD = "250 millis";

/** Where the prompt reports its failures and the steps it lost. */
const SOURCE = "components/tenant/exams/prompt";

/** Tells the teacher why a file was not added as an image: it is over the byte limit, or no PNG, JPEG, WebP, or GIF image. */
const refuseFile = (refusal: ImageRefusal) => {
  if (refusal === "size") {
    toast.error({
      description: "image-refused-size.description",
      title: "image-refused-size.title",
    });
    return;
  }
  toast.error({
    description: "image-refused-type.description",
    title: "image-refused-type.title",
  });
};

/** Tells the teacher that an image of more than the byte limit was not added. */
const refuseLargePicture = () => Effect.sync(() => refuseFile("size"));

/** Tells the teacher that a file that is no PNG, JPEG, WebP, or GIF image was not added. */
const refuseOtherPicture = () => Effect.sync(() => refuseFile("type"));

/**
 * The extensions of a question's prompt: the assessment document of the contract, its
 * collab plugin (the session's client ID comes with the document when it opens), the classes
 * of the published article's paragraphs, and the bounds the server folds with, so the editor
 * refuses what the server would refuse.
 */
const PROMPT_EXTENSIONS = [
  ...documentExtensions(ASSESSMENT_RULES, {
    ...FORMULA_VIEWS,
    image: PICTURE_VIEW,
  }),
  Collab.configure({ clientId: "", version: 0 }),
  articleParagraphs,
  depthGuard(MAX_DOCUMENT_DEPTH),
  stepSizeGuard(MAX_STEP_BYTES),
  documentSizeGuard(MAX_DOCUMENT_BYTES),
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
 * One sync round of the prompt. A round that meets a fold waits for it: the batch stays unsent
 * under its id, and `tickThroughFold` runs the round again, so the editor shows no failure
 * while the fold runs (ADR 0028). The waiting ends when the server takes the batch, when the
 * round is replaced, or when the prompt closes, and the closing flush takes over the steps that
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

/**
 * The prompt of one question: the document the teacher writes, edited together with the
 * other editors of the question and synced through the server (ADR 0028). It is read-only
 * until the server opens the document, and it stays read-only once the exam is frozen. A local
 * change schedules a round after `SEND_QUIET_PERIOD`, and the server's steps arrive through a
 * subscription, so the editor takes them without polling. When the prompt closes, the round it
 * waits for stops, and the steps the editor holds are sent.
 */
export function ExamPrompt({ prompt }: { prompt: Id<"editorDocuments"> }) {
  const t = useTranslations("Exams");
  const { exam, slug } = useExam();
  const examId = exam.id;
  const frozen = isFrozen(exam);
  const labels = useDocumentLabels();
  // The pictures the teacher chose, in order. The alt-text dialog works through them one at a time.
  const [pending, setPending] = useState<readonly File[]>([]);
  const chosen = Option.getOrNull(Arr.head(pending));
  const preview = useObjectUrl(chosen);
  // The images the document holds, which the page resolves to addresses in one read.
  const [pictureIds, setPictureIds] = useState<readonly Id<"examAssets">[]>([]);
  const pictureUrls = useQuery(
    exams.assets.urls,
    pictureIds.length === 0 ? "skip" : { assets: pictureIds, examId, slug }
  );
  const pictureAddresses = useMemo(
    () =>
      QueryResult.isSuccess(pictureUrls)
        ? Rec.fromEntries(
            Arr.map(
              pictureUrls.value,
              (asset) => [asset.id, asset.url] as const
            )
          )
        : {},
    [pictureUrls]
  );
  const requestUrl = useMutation(exams.assets.uploadUrl);
  const register = useAction(exams.assets.register);
  /** A file the teacher chose is refused at once when the editor cannot take it, and otherwise waits in the queue. */
  const beginPicture = useCallback((file: File) => {
    const refusal = imageRefusal(file);
    if (Option.isSome(refusal)) {
      refuseFile(refusal.value);
      return;
    }
    setPending((queue) => [...queue, file]);
  }, []);
  const extensions = useMemo(
    () => [
      ...PROMPT_EXTENSIONS,
      pictureFileHandler(beginPicture),
      slashCommand({ label: labels.insert, labels: labels.slash }),
    ],
    [beginPicture, labels]
  );
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
  // The fiber that opens the document, and the fiber of the round that the editor waits for: the
  // quiet period after a change, or the next try of a round that met a fold.
  const opening = useRef<Fiber.Fiber<void> | null>(null);
  const waiting = useRef<Fiber.Fiber<void> | null>(null);

  // A `behind` reply makes the round reopen the document from its snapshot, so it starts one too.
  useEffect(() => {
    if (
      QueryResult.isSuccess(reply) &&
      (reply.value._tag === "behind" ||
        (reply.value._tag === "steps" && reply.value.steps.length > 0))
    ) {
      replaceWaiting(waiting, runRound(session.current, view.current, sync));
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

  /**
   * Opens the document for the session, then turns editing on once the server answered, unless
   * the exam is frozen.
   */
  const open = (editor: {
    readonly view: EditorView;
    registerPlugin: (plugin: Plugin) => unknown;
    setEditable: (on: boolean) => unknown;
  }) => {
    view.current = editor.view;
    // Every document the view installs, the server's included, reports its images to the page.
    editor.registerPlugin(pictureIdsPlugin(setPictureIds));
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
            editor.setEditable(!frozen);
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
    replaceWaiting(
      waiting,
      Effect.sleep(SEND_QUIET_PERIOD).pipe(
        Effect.andThen(
          Effect.suspend(() => runRound(session.current, view.current, sync))
        )
      )
    );
  };

  /**
   * Stores the chosen file as an image of this exam, then places it in the document at the caret.
   * A refused file leaves the document as it was, and says why in the toast.
   */
  const addPicture = (file: File, alt: string) =>
    Effect.runFork(
      storeExamImage({
        file,
        register: (args) => register({ examId, slug, ...args }),
        requestUrl: () => requestUrl({ examId, slug }),
      }).pipe(
        Effect.tap((stored) =>
          Effect.sync(() => {
            const current = view.current;
            if (current !== null) {
              current.dispatch(
                current.state.tr.replaceSelectionWith(
                  current.state.schema.nodes.image.create({
                    alt,
                    asset: stored.id,
                    height: stored.height,
                    width: stored.width,
                  })
                )
              );
            }
          })
        ),
        Effect.catchTags({
          AssetSizeRefused: refuseLargePicture,
          AssetTypeRefused: refuseOtherPicture,
          ImageUnreadable: refuseOtherPicture,
        }),
        Effect.catch(() =>
          Effect.sync(() =>
            toast.error({
              description: "action-error.description",
              title: "action-error.title",
            })
          )
        )
      )
    );

  return (
    <FormulaLabelsProvider labels={labels.formulaEdit}>
      <PicturesProvider
        begin={beginPicture}
        labels={labels.pictures}
        urls={pictureAddresses}
      >
        <PictureAltDialog
          alt=""
          labels={labels.pictures}
          onCancel={() => setPending((queue) => Arr.drop(queue, 1))}
          onConfirm={(alt) => {
            if (chosen !== null) {
              addPicture(chosen, alt);
            }
            setPending((queue) => Arr.drop(queue, 1));
          }}
          preview={preview}
          submit={labels.pictures.add}
          title={labels.pictures.add}
        />
        <DocumentEditor
          extensions={extensions}
          label={t("prompt-label")}
          onChange={change}
          onEditor={open}
          placeholder={t("prompt-placeholder")}
        >
          <DocumentToolbar labels={labels.toolbar} />
        </DocumentEditor>
      </PicturesProvider>
    </FormulaLabelsProvider>
  );
}
