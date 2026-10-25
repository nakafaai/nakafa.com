import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { useCallbackRef } from "@mantine/hooks";
import { MAX_DOCUMENT_DEPTH } from "@nakafa/aksara-contracts/assessment/document";
import { MAX_DOCUMENT_BYTES } from "@repo/backend/confect/editor/size";
import { depthGuard } from "@repo/design-system/components/editor/depth";
import type { DocumentEditorInstance } from "@repo/design-system/components/editor/document";
import { documentSizeGuard } from "@repo/design-system/components/editor/size";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Node } from "@tiptap/pm/model";
import { Effect, Option } from "effect";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import {
  holdsLabel,
  type OptionEdit,
  type OptionLabel,
  optionEditOf,
} from "@/components/tenant/exams/answer";
import { RICH_EXTENSIONS } from "@/components/tenant/exams/extensions";
import { ExamDocument } from "@/components/tenant/exams/rich";
import { ControlRoom, PaperOption } from "@/components/tenant/exams/sheet";
import { assessmentSchema } from "@/lib/editor/assessment";
import { makeQuietSaver } from "@/lib/save/quiet";

/** The quiet period after the last change of an option, before its label is saved. */
const OPTION_SAVE_QUIET = "500 millis";

/**
 * The extensions of an option: the assessment document, without a collab session, and the bounds the
 * server holds it to. An option draws no paragraph classes of the article, since its paragraphs take
 * no margin: the frame around the text gives the spacing.
 */
const OPTION_EXTENSIONS = [
  ...RICH_EXTENSIONS,
  depthGuard(MAX_DOCUMENT_DEPTH),
  documentSizeGuard(MAX_DOCUMENT_BYTES),
];

/** The props of one option row: the option it shows, and the teacher's controls beside it. */
interface OptionRowProps {
  /** The label the option holds as the server saved it, which the editor starts with. */
  readonly label: OptionLabel;
  /** The letter that names the option by its place. */
  readonly letter: string;
  /** Whether the option is locked, so its text and its controls take no change. */
  readonly locked: boolean;
  /** The number of the question, which names the option for assistive technology. */
  readonly number: number;
  /** Removes the option, or none while the question holds the fewest options it may take. */
  readonly onRemove: (() => void) | null;
  /**
   * Saves the label the option's editor holds, after its quiet period. Calls `unstored` when the server does not store it.
   */
  readonly onSave: (label: OptionLabel, unstored: () => void) => void;
}

/**
 * One option of a question: its letter and its rich text framed as the player frames it, then the
 * teacher's remove control to its right. The key of the question is marked in the teacher's layer,
 * not here. Removing is shown when the option may go, on hover or focus, and always on a touch
 * screen. The text saves after its quiet period once the teacher types in it. A change that edits no
 * text, such as the editor taking its lock, saves nothing. Removing the option drops the pending save
 * of its text. A label the server does not store, because its save was refused or dropped, goes back
 * into the editor, unless the teacher has typed on since. An option the server has not saved yet is locked.
 */
export function OptionRow({
  letter,
  label,
  locked,
  number,
  onRemove,
  onSave,
}: OptionRowProps) {
  const t = useTranslations("Exams");
  const editor = useRef<DocumentEditorInstance | null>(null);
  // The save calls the latest `onSave`, so a save after the quiet period uses the answers and the
  // revision of the render that is on screen when it runs.
  const save = useCallbackRef(onSave);
  // The editor remounts with the label the server holds when a label the server did not store goes back into it.
  const [editorRound, setEditorRound] = useState(0);
  // A label the server did not store goes back into the editor, unless the teacher has typed on since: the editor
  // then holds other text, which the next quiet save sends.
  const restoreUnstored = useCallbackRef((label: OptionLabel) => {
    if (
      editor.current !== null &&
      holdsLabel(editor.current.getJSON(), label)
    ) {
      setEditorRound((round) => round + 1);
    }
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
            save(edit.label, () => restoreUnstored(edit.label));
          }),
        OPTION_SAVE_QUIET
      )
    )
  );

  // Removing the option drops the quiet save of its label first. The removal makes that save stale,
  // since it would send the answers of a revision the server has already moved past.
  const remove = () => {
    if (onRemove === null) {
      return;
    }
    Effect.runFork(saver.cancel);
    onRemove();
  };

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
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [saver]);

  return (
    <div className="group/option grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
      <PaperOption letter={letter}>
        <ExamDocument
          extensions={OPTION_EXTENSIONS}
          key={editorRound}
          label={t("option-of", { letter, number })}
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
            next.commands.setContent(
              Node.fromJSON(assessmentSchema, label).toJSON(),
              { emitUpdate: false }
            );
            next.setEditable(!locked, false);
          }}
          placeholder={t("option-placeholder")}
          size="line"
        />
      </PaperOption>
      <div className="flex items-center gap-1">
        {onRemove === null ? (
          <ControlRoom />
        ) : (
          <Button
            aria-label={t("option-remove-of", { letter, number })}
            className="opacity-0 pointer-coarse:opacity-100 group-focus-within/option:opacity-100 group-hover/option:opacity-100"
            disabled={locked}
            onClick={remove}
            size="icon"
            type="button"
            variant="ghost"
          >
            <HugeIcons aria-hidden="true" icon={Cancel01Icon} />
          </Button>
        )}
      </div>
    </div>
  );
}
