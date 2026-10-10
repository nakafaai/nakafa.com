"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import {
  MEMORY_TEXT_LIMIT,
  MEMORY_TITLE_LIMIT,
} from "@repo/backend/confect/nina/memory.spec";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { String as Str } from "effect";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useAutosave } from "@/components/user/settings/memory/autosave.client";
import { MemoryFacts } from "@/components/user/settings/memory/facts";
import {
  draftOf,
  type Memory,
  type MemoryDraft,
} from "@/components/user/settings/memory/list";
import { useMemoryPage } from "@/components/user/settings/memory/provider";

/** The editor loads when a learner opens it, never with the page. */
const Editor = dynamic(
  () =>
    import("@repo/design-system/components/editor/rich").then(
      (module) => module.RichEditor
    ),
  { loading: () => null, ssr: false }
);

/**
 * One opening of the editor, from top to bottom: the title, which the learner
 * writes in place, the text, and a foot with the length of the text and the
 * button that deletes the memory. Everything the learner writes is saved by
 * itself. After a save that failed, the editor opens again with what they
 * wrote.
 */
export function MemoryDocument({ memory }: { memory: Memory | undefined }) {
  const t = useTranslations("Memory");
  const labels = useTranslations("Editor");
  const common = useTranslations("Common");
  const close = useMemoryPage((state) => state.close);
  const restored = useMemoryPage((state) => state.draft);
  const [starting] = useState(() => restored ?? draftOf(memory));
  const [draft, setDraft] = useState(starting);
  const { change, discard } = useAutosave(memory, starting);
  const body = useRef<HTMLDivElement>(null);
  const length = Str.length(Str.trim(draft.text));

  /** Shows what the learner wrote and hands it to the saving. */
  function write(next: MemoryDraft) {
    setDraft(next);
    change(next);
  }

  return (
    <>
      <header className="flex items-start gap-2 border-b p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <input
            aria-label={t("title")}
            className="-mx-1.5 min-w-0 truncate rounded-sm bg-transparent px-1.5 py-0.5 font-semibold outline-none transition-colors ease-out placeholder:text-muted-foreground hover:bg-muted focus-visible:bg-muted"
            maxLength={MEMORY_TITLE_LIMIT}
            onChange={(event) => write({ ...draft, title: event.target.value })}
            onKeyDown={(event) => {
              // Enter leaves the title for the text, as in a document. While
              // the learner composes a character, Enter belongs to the keyboard.
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                body.current
                  ?.querySelector<HTMLElement>("[contenteditable]")
                  ?.focus();
              }
            }}
            placeholder={t("untitled")}
            value={draft.title}
          />
          {memory ? (
            <p className="truncate text-muted-foreground text-sm">
              <MemoryFacts memory={memory} />
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
      <div className="flex min-h-0 flex-1 flex-col" ref={body}>
        <Editor
          defaultValue={starting.text}
          label={t("text")}
          labels={{
            bold: labels("bold"),
            bullets: labels("bullets"),
            code: labels("code"),
            codeBlock: labels("code-block"),
            divider: labels("divider"),
            heading1: labels("heading-1"),
            heading2: labels("heading-2"),
            heading3: labels("heading-3"),
            highlight: labels("highlight"),
            italic: labels("italic"),
            link: labels("link"),
            linkPlaceholder: labels("link-placeholder"),
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
          placeholder={t("placeholder")}
        />
      </div>
      <footer className="flex items-center justify-between gap-2 border-t p-4">
        <p
          className="text-muted-foreground text-sm tabular-nums data-full:text-destructive"
          data-full={length >= MEMORY_TEXT_LIMIT ? "" : undefined}
        >
          {t("count", { count: length, limit: MEMORY_TEXT_LIMIT })}
        </p>
        <Button
          onClick={() => {
            discard();
            close();
          }}
          variant="destructive"
        >
          {common("delete")}
        </Button>
      </footer>
    </>
  );
}
