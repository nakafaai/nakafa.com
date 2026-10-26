import { Cancel01Icon } from "@hugeicons/core-free-icons";
import {
  MEMORY_TEXT_LIMIT,
  MEMORY_TITLE_LIMIT,
} from "@repo/backend/confect/nina/memory.spec";
import { editorFrame } from "@repo/design-system/components/editor/frame";
import { EditorPane } from "@repo/design-system/components/editor/pane";
import { plainText } from "@repo/design-system/components/editor/plain";
import type * as RichEditorModule from "@repo/design-system/components/editor/rich";
import type * as EditorPreviewModule from "@repo/design-system/components/editor/words";
import { Button } from "@repo/design-system/components/ui/button";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { isEnterOutsideComposition } from "@repo/design-system/lib/keyboard";
import { toast } from "@repo/design-system/lib/toast/notify";
import { type Option, String as Str } from "effect";
import { type ComponentProps, Suspense, use, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { MemoryDeleteDialog } from "@/components/user/settings/memory/delete";
import {
  MemoryEnds,
  MemoryOrigin,
} from "@/components/user/settings/memory/facts";
import {
  focusAfterDelete,
  memoryNeighbour,
  NO_NEIGHBOUR,
} from "@/components/user/settings/memory/focus";
import {
  isBlank,
  type Memory,
  type MemoryDraft,
} from "@/components/user/settings/memory/list";
import {
  loadEditorPreviewModule,
  loadRichEditorModule,
} from "@/components/user/settings/memory/module";
import {
  useMemoryPage,
  useShownMemories,
} from "@/components/user/settings/memory/provider";
import { useAutosave } from "@/components/user/settings/memory/saving";

/**
 * The rich editor, drawn once its code has loaded. The code loads when a learner
 * opens the editor, never with the page.
 */
function Editor(props: ComponentProps<typeof RichEditorModule.RichEditor>) {
  const { RichEditor } = use(loadRichEditorModule());

  return <RichEditor {...props} />;
}

/** The saved words drawn as the editor draws them, which show while the editor's code loads. */
function Preview(
  props: ComponentProps<typeof EditorPreviewModule.EditorPreview>
) {
  const { EditorPreview } = use(loadEditorPreviewModule());

  return <EditorPreview {...props} />;
}

/**
 * The saved words as plain text, in the frame the editor and its preview share.
 * It shows until the preview's code arrives, so the words never leave their
 * place: the frame is the same, and only the drawing of the words changes.
 */
function SavedWords({ markdown }: { markdown: string }) {
  const words = plainText(markdown);

  return (
    <EditorPane>
      <p dir="auto">{words === "" ? <br /> : words}</p>
    </EditorPane>
  );
}

/**
 * One opening of the editor, from top to bottom: the title, which the learner
 * writes in place, the text, and a foot with the length of the text and the
 * button that deletes the memory. A new memory has nothing to delete, so the
 * button waits for the first word. From then on it stays, because a first
 * save may be on its way even when the learner has erased every word again.
 * Everything the learner writes is saved by itself. After a save that failed,
 * the editor opens again with what they wrote. While the editor's code loads,
 * the saved words show in the editor's own frame: as the preview draws them when
 * its code has arrived, and as plain text before that or when the preview's code
 * cannot load, so nothing moves when the editor arrives. `open` is false while a
 * closing editor is still on the page, and such an editor takes no focus.
 */
export function MemoryDocument({ memory }: { memory: Memory | null }) {
  const open = useMemoryPage((state) => state.open);
  const t = useTranslations("Memory");
  const labels = useTranslations("Editor");
  const common = useTranslations("Common");
  const close = useMemoryPage((state) => state.close);
  const restored = useMemoryPage((state) => state.draft);
  const shown = useShownMemories();
  const { change, discard, starting } = useAutosave(memory, restored);
  const [draft, setDraft] = useState(starting);
  const [written, setWritten] = useState(() => !isBlank(starting));
  const [asking, setAsking] = useState(false);
  // The memory after this one in the list, read when the learner confirms the
  // delete. A new memory has none, so the focus goes to the Add memory button.
  const neighbour = useRef<Option.Option<Memory["id"]>>(NO_NEIGHBOUR);
  // Set when the learner confirms the delete, so the question gives the focus to
  // the neighbour. Cleared each time the question opens.
  const confirmed = useRef(false);
  const body = useRef<HTMLDivElement>(null);
  const length = Str.length(Str.trim(draft.text));
  // A confirmed delete hands the focus to the neighbour's row. A cancelled
  // question returns it to where it was, as the dialog does on its own.
  const focusAfterQuestion = () =>
    confirmed.current ? focusAfterDelete(neighbour.current) : true;

  /** Shows what the learner wrote and hands it to the saving. */
  function write(next: MemoryDraft) {
    setDraft(next);
    setWritten((was) => was || !isBlank(next));
    change(next);
  }

  return (
    <>
      <header className="flex items-start gap-2 border-b p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <input
            aria-label={t("title")}
            className="-mx-1.5 min-w-0 truncate rounded-sm bg-transparent px-1.5 py-0.5 font-semibold outline-none transition-colors ease-out placeholder:text-muted-foreground hover:bg-muted focus-visible:bg-muted"
            dir="auto"
            maxLength={MEMORY_TITLE_LIMIT}
            onChange={(event) => write({ ...draft, title: event.target.value })}
            onKeyDown={(event) => {
              // Enter leaves the title for the text, as in a document. While
              // the learner composes a character, Enter belongs to the keyboard.
              if (isEnterOutsideComposition(event.nativeEvent)) {
                event.preventDefault();
                body.current
                  ?.querySelector<HTMLElement>("[contenteditable]")
                  ?.focus();
              }
            }}
            placeholder={t("untitled")}
            value={draft.title}
          />
          {memory?.validUntil === undefined ? null : (
            <p className="text-muted-foreground text-sm">
              <MemoryEnds validUntil={memory.validUntil} />
            </p>
          )}
          {memory ? (
            <p className="text-muted-foreground text-sm">
              <MemoryOrigin memory={memory} />
            </p>
          ) : null}
        </div>
        <Button
          aria-label={common("close")}
          onClick={close}
          size="icon-sm"
          variant="ghost"
        >
          <HugeIcons icon={Cancel01Icon} />
        </Button>
      </header>
      <div className={editorFrame()} ref={body}>
        <Suspense
          fallback={
            <ErrorBoundary fallback={<SavedWords markdown={starting.text} />}>
              <Suspense fallback={<SavedWords markdown={starting.text} />}>
                <Preview
                  markdown={starting.text}
                  placeholder={t("placeholder")}
                />
              </Suspense>
            </ErrorBoundary>
          }
        >
          <Editor
            autoFocus={open}
            defaultValue={starting.text}
            label={t("text")}
            labels={{
              arabic: labels("arabic"),
              bold: labels("bold"),
              bullets: labels("bullets"),
              code: labels("code"),
              codeBlock: labels("code-block"),
              divider: labels("divider"),
              heading1: labels("heading-1"),
              heading2: labels("heading-2"),
              heading3: labels("heading-3"),
              highlight: labels("highlight"),
              insert: labels("insert"),
              italic: labels("italic"),
              link: labels("link"),
              linkPlaceholder: labels("link-placeholder"),
              lists: labels("lists"),
              more: labels("more"),
              numbers: labels("numbers"),
              quote: labels("quote"),
              redo: labels("redo"),
              strike: labels("strike"),
              style: labels("style"),
              tasks: labels("tasks"),
              text: labels("text"),
              underline: labels("underline"),
              undo: labels("undo"),
            }}
            limit={MEMORY_TEXT_LIMIT}
            onChange={(text) => write({ ...draft, text })}
            onClose={close}
            onRefuse={() => toast.error({ title: "memory-too-long.title" })}
            placeholder={t("placeholder")}
          />
        </Suspense>
      </div>
      <footer className="flex items-center justify-between gap-2 border-t p-4">
        <p
          className="text-muted-foreground text-sm tabular-nums data-full:text-destructive"
          data-full={length >= MEMORY_TEXT_LIMIT ? "" : undefined}
        >
          {t("count", { count: length, limit: MEMORY_TEXT_LIMIT })}
        </p>
        <Button
          disabled={memory === null && !written}
          onClick={() => {
            confirmed.current = false;
            setAsking(true);
          }}
          variant="destructive"
        >
          {common("delete")}
        </Button>
      </footer>
      <MemoryDeleteDialog
        finalFocus={focusAfterQuestion}
        onConfirm={() => {
          neighbour.current =
            memory === null ? NO_NEIGHBOUR : memoryNeighbour(shown, memory.id);
          confirmed.current = true;
          setAsking(false);
          discard();
          close();
        }}
        onOpenChange={setAsking}
        open={asking}
      />
    </>
  );
}
