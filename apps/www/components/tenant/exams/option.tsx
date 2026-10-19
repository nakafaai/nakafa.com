"use client";

import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useCallbackRef } from "@mantine/hooks";
import { MAX_DOCUMENT_DEPTH } from "@nakafa/aksara-contracts/assessment/document";
import { MAX_DOCUMENT_BYTES } from "@repo/backend/confect/editor/size";
import { depthGuard } from "@repo/design-system/components/editor/depth";
import type { DocumentEditorInstance } from "@repo/design-system/components/editor/document";
import { articleParagraphs } from "@repo/design-system/components/editor/paragraph";
import { documentSizeGuard } from "@repo/design-system/components/editor/size";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Node } from "@tiptap/pm/model";
import { Effect, Option } from "effect";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import {
  type OptionLabel,
  optionLabelOf,
} from "@/components/tenant/exams/answer";
import { RICH_EXTENSIONS } from "@/components/tenant/exams/extensions";
import { ExamDocument } from "@/components/tenant/exams/rich";
import { ControlRoom, PaperOption } from "@/components/tenant/exams/sheet";
import { assessmentSchema } from "@/lib/editor/assessment";
import { makeQuietSaver } from "@/lib/save/quiet";

/** The quiet period after the last change of an option, before its label is saved. */
const OPTION_SAVE_QUIET = "500 millis";

/** The extensions of an option: the assessment document, without a collab session, and the bounds the server holds it to. */
const OPTION_EXTENSIONS = [
  ...RICH_EXTENSIONS,
  articleParagraphs,
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
  /** Whether the option is the key of the question. */
  readonly marked: boolean;
  /** The number of the question, which names the option for assistive technology. */
  readonly number: number;
  /** Marks the option as the key of the question, which saves at once. */
  readonly onMark: () => void;
  /** Removes the option, or none while the question holds the fewest options it may take. */
  readonly onRemove: (() => void) | null;
  /** Saves the label the option's editor holds, after its quiet period. */
  readonly onSave: (label: OptionLabel) => void;
}

/**
 * One option of a question: its letter and its rich text framed as the player frames it, then the
 * teacher's controls to its right. The key toggle is solid and pressed for the key. Removing is
 * shown when the option may go, on hover or focus, and always on a touch screen. The text saves
 * after its quiet period, and a key change saves at once. Removing the option drops the pending save
 * of its text. An option the server has not saved yet is locked.
 */
export function OptionRow({
  letter,
  label,
  locked,
  marked,
  number,
  onMark,
  onRemove,
  onSave,
}: OptionRowProps) {
  const t = useTranslations("Exams");
  const editor = useRef<DocumentEditorInstance | null>(null);
  // The save calls the latest `onSave`, so a save after the quiet period uses the answers and the
  // revision of the render that is on screen when it runs.
  const save = useCallbackRef(onSave);
  const [saver] = useState(() =>
    Effect.runSync(
      makeQuietSaver((run: () => void) => Effect.sync(run), OPTION_SAVE_QUIET)
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
  useEffect(() => {
    editor.current?.setEditable(!locked);
  }, [locked]);

  return (
    <div className="group/option grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
      <PaperOption letter={letter}>
        <ExamDocument
          extensions={OPTION_EXTENSIONS}
          label={t("option-of", { letter, number })}
          onChange={() => {
            Effect.runFork(
              saver.touch(() => {
                const current = editor.current;
                if (current === null) {
                  return;
                }
                Option.match(optionLabelOf(current.getJSON()), {
                  onNone: () =>
                    toast.error({
                      description: "action-error.description",
                      title: "action-error.title",
                    }),
                  onSome: (next) => save(next),
                });
              })
            );
          }}
          onEditor={(next) => {
            editor.current = next;
            next.commands.setContent(
              Node.fromJSON(assessmentSchema, label).toJSON(),
              { emitUpdate: false }
            );
            next.setEditable(!locked);
          }}
          placeholder={t("option-placeholder")}
          size="line"
        />
      </PaperOption>
      <div className="flex items-center gap-1">
        <Button
          aria-label={t("key-option", { letter, number })}
          aria-pressed={marked}
          disabled={locked}
          onClick={onMark}
          size="icon"
          type="button"
          variant={marked ? "default" : "outline"}
        >
          <HugeIcons aria-hidden="true" icon={Tick02Icon} />
        </Button>
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
