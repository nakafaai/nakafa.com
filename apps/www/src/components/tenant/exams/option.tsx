import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { useCallbackRef } from "@mantine/hooks";
import { MAX_DOCUMENT_DEPTH } from "@nakafa/aksara-contracts/assessment/document";
import { MAX_DOCUMENT_BYTES } from "@repo/backend/confect/editor/size";
import { depthGuard } from "@repo/design-system/components/editor/depth";
import type { DocumentEditorInstance } from "@repo/design-system/components/editor/document";
import { articleProse } from "@repo/design-system/components/editor/prose";
import { documentSizeGuard } from "@repo/design-system/components/editor/size";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Node } from "@tiptap/pm/model";
import { Effect, Option } from "effect";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import {
  holdsLabel,
  type OptionEdit,
  type OptionLabel,
  optionEditOf,
} from "@/components/tenant/exams/answer";
import { RICH_EXTENSIONS } from "@/components/tenant/exams/extensions";
import { refusePaste } from "@/components/tenant/exams/picture";
import { ExamDocumentWiringProvider } from "@/components/tenant/exams/rich";
import type { Unstored } from "@/components/tenant/exams/writer";
import { assessmentSchema } from "@/lib/editor/assessment";
import { makeQuietSaver } from "@/lib/save/quiet";

/** The quiet period after the last change of an option, before its label is saved. */
const OPTION_SAVE_QUIET = "500 millis";

/**
 * The extensions of an option: the assessment document, without a collab session, the classes of the
 * published article's text, and the bounds the server holds it to. An option draws no paragraph classes
 * of the article, since its paragraphs take no margin: the frame around the text gives the spacing.
 */
const OPTION_EXTENSIONS = [
  ...RICH_EXTENSIONS,
  articleProse.configure({ paragraphs: false }),
  depthGuard(MAX_DOCUMENT_DEPTH),
  documentSizeGuard(MAX_DOCUMENT_BYTES, refusePaste),
];

/** The props of one option row: the option it shows, and the teacher's controls beside it. */
interface OptionRowProps {
  /**
   * The option the caller composes: its letter's frame around an `ExamDocument`, named for assistive
   * technology, such as "Question 1, option A", with the text its empty editor shows.
   */
  readonly children: ReactNode;
  /** The label the option holds as the server saved it, which the editor starts with. */
  readonly label: OptionLabel;
  /** Whether the option is locked, so its text and its controls take no change. */
  readonly locked: boolean;
  /**
   * Removes the option, or none for a part that stays: an option while the question holds the fewest it may take,
   * or a column of a true or false table.
   */
  readonly onRemove: (() => void) | null;
  /**
   * Saves the label the option's editor holds, after its quiet period. Calls `unstored` when the server does not store it.
   */
  readonly onSave: (label: OptionLabel, unstored: Unstored) => void;
  /** The name of the remove control for assistive technology. */
  readonly removeName: string;
}

/**
 * One option of a question: the letter and the rich text the caller composes, framed as the player
 * frames it, as wide as the student reads it, with the teacher's remove control over its end. The row wires the text it holds. The key of the question is marked in the teacher's layer,
 * not here. Removing is shown when the option may go, on hover or focus, and always on a touch
 * screen. The text saves after its quiet period once the teacher types in it. A change that edits no
 * text, such as the editor taking its lock, saves nothing. Removing the option drops the pending save
 * of its text. A label the server refused goes back into the editor, unless the teacher has typed on since. A
 * save the server never answered keeps the teacher's words in the editor, with a retry under them, since the
 * server may still take them. An option the server has not saved yet is locked.
 */
export function OptionRow({
  children,
  label,
  locked,
  onRemove,
  onSave,
  removeName,
}: OptionRowProps) {
  const t = useTranslations("Exams");
  const tCommon = useTranslations("Common");
  const editor = useRef<DocumentEditorInstance | null>(null);
  // Whether the words in the editor went unanswered, which shows the retry until the server holds them.
  const [unsaved, setUnsaved] = useState(false);
  // The label the server held at the last render, which the editor holds too while the teacher has typed nothing
  // on top of it since.
  const previous = useRef(label);
  // The save calls the latest `onSave`, so a save after the quiet period uses the answers and the
  // revision of the render that is on screen when it runs.
  const save = useCallbackRef(onSave);
  // The editor remounts with the label the server holds when a label the server did not store goes back into it.
  const [editorRound, setEditorRound] = useState(0);
  // A label the server refused goes back into the editor, unless the teacher has typed on since: the editor then
  // holds other text, which the next quiet save sends.
  const restoreUnstored = useCallbackRef((label: OptionLabel) => {
    if (
      editor.current !== null &&
      holdsLabel(editor.current.getJSON(), label)
    ) {
      setEditorRound((round) => round + 1);
    }
  });
  // Sends one label, and keeps the words when the server never answered, or takes the label back when it refused.
  const saveLabel = useCallbackRef((next: OptionLabel) => {
    save(next, (reason) => {
      if (reason === "unanswered") {
        setUnsaved(true);
        return;
      }
      restoreUnstored(next);
    });
  });
  // The quiet save takes the edit the teacher made last: a label to save, or a refusal to report.
  const [saver] = useState(() =>
    Effect.runSync(
      makeQuietSaver(
        (edit: OptionEdit) =>
          Effect.sync(() => {
            if (edit.kind === "refused") {
              toast.error({
                description: "action-error.description",
                title: "action-error.title",
              });
              return;
            }
            saveLabel(edit.label);
          }),
        OPTION_SAVE_QUIET
      )
    )
  );

  /** Saves the words the editor holds again, after a save the server never answered. */
  const retry = () => {
    const edit = optionEditOf({
      docChanged: true,
      json: editor.current?.getJSON(),
    });
    if (Option.isSome(edit)) {
      setUnsaved(false);
      Effect.runFork(saver.touch(edit.value).pipe(Effect.andThen(saver.flush)));
    }
  };

  // Removing the option drops the quiet save of its label first. The removal makes that save stale,
  // since it would send the answers of a revision the server has already moved past.
  const remove = () => {
    Effect.runFork(saver.cancel);
    onRemove?.();
  };

  // The editor takes a label the server holds once it changes, as a save of this option lands after the editor
  // opened, or another editor saves it. An editor that no longer holds the label it had before has the teacher's
  // own typing, which waits for its save and wins.
  useEffect(() => {
    const before = previous.current;
    previous.current = label;
    const current = editor.current;
    if (current === null) {
      return;
    }
    const held = current.getJSON();
    if (holdsLabel(held, label)) {
      setUnsaved(false);
      return;
    }
    if (!holdsLabel(held, before)) {
      return;
    }
    current.commands.setContent(
      Node.fromJSON(assessmentSchema, label).toJSON(),
      { emitUpdate: false }
    );
  }, [label]);

  // The editor takes the lock of the option as it changes, not only when it opens.
  // A lock is not an edit, so the editor emits no change for it, and no label is saved.
  useEffect(() => {
    editor.current?.setEditable(!locked, false);
  }, [locked]);

  // A row saves the label it still waits on when its page is hidden and when the row unmounts. Left to
  // its timer, the save would call the callback of the row's last render, which may hold a revision the
  // server has moved past. The browser may end a closing page before the save leaves, so the flush sends
  // what the page can, and the server answers what it receives.
  useEffect(() => {
    const flush = () => {
      Effect.runFork(saver.flush);
    };
    // A page that closes with words the server does not hold yet asks first, since a save may not leave in time.
    const askFirst = (event: BeforeUnloadEvent) => {
      if (
        editor.current !== null &&
        !holdsLabel(editor.current.getJSON(), previous.current)
      ) {
        flush();
        event.preventDefault();
      }
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", askFirst);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", askFirst);
      flush();
    };
  }, [saver]);

  return (
    <div className="group/option relative">
      <ExamDocumentWiringProvider
        content={Node.fromJSON(assessmentSchema, label).toJSON()}
        extensions={OPTION_EXTENSIONS}
        onChange={(transaction) => {
          const current = editor.current;
          if (current === null) {
            return;
          }
          const edit = optionEditOf({
            docChanged: transaction.docChanged,
            json: current.getJSON(),
          });
          if (Option.isNone(edit)) {
            return;
          }
          Effect.runFork(saver.touch(edit.value));
        }}
        onEditor={(next) => {
          editor.current = next;
          next.setEditable(!locked, false);
        }}
      >
        <Fragment key={editorRound}>{children}</Fragment>
      </ExamDocumentWiringProvider>
      {onRemove === null ? null : (
        <Button
          aria-label={removeName}
          className="absolute end-1.5 top-1.5 opacity-0 group-focus-within/option:opacity-100 group-hover/option:opacity-100 pointer-coarse:opacity-100"
          data-remove=""
          disabled={locked}
          onClick={remove}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <HugeIcons aria-hidden="true" icon={Cancel01Icon} />
        </Button>
      )}
      {unsaved ? (
        <div
          className="flex items-center justify-between gap-2 pt-1"
          role="alert"
        >
          <p className="text-destructive text-xs">{t("option-unsaved")}</p>
          <Button onClick={retry} size="sm" type="button" variant="outline">
            {tCommon("retry")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
