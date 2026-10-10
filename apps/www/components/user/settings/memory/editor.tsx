"use client";

import { MEMORY_TEXT_LIMIT } from "@repo/backend/confect/nina/memory.spec";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { Array as Arr, Option, String as Str } from "effect";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useMemoryActions } from "@/components/user/settings/memory/actions.client";
import { MemoryFacts } from "@/components/user/settings/memory/facts";
import { canSave, type Memory } from "@/components/user/settings/memory/list";
import {
  useMemory,
  useMemoryPage,
} from "@/components/user/settings/memory/provider";

/** The editor loads when a learner opens the panel, never with the page. */
const Editor = dynamic(
  () =>
    import("@repo/design-system/components/editor/rich").then(
      (module) => module.RichEditor
    ),
  { loading: () => null, ssr: false }
);

/**
 * The panel beside the page where the learner writes a new memory or rewrites
 * one. It does not cover the page, so the list stays in reach and a press on
 * another memory moves the editor to it. On a small screen it takes the whole
 * width. While it is open it leaves a mark that the settings layout reads to
 * make room for it on a wide screen.
 */
export function MemoryEditor() {
  const { close, session, target, wanted } = useMemoryPage((state) => ({
    close: state.close,
    session: state.session,
    target: state.target,
    wanted: state.open,
  }));
  const memory = useMemory((list) =>
    Option.getOrUndefined(
      Arr.findFirst(list.memories, ({ id }) => id === target)
    )
  );
  // A memory that was deleted meanwhile has no editor.
  const gone = target !== null && memory === undefined;
  const open = wanted && !gone;

  return (
    <>
      {open ? <span data-slot="memory-editor-open" hidden /> : null}
      <Sheet
        disablePointerDismissal
        modal={false}
        onOpenChange={(next) => {
          if (!next) {
            close();
          }
        }}
        open={open}
      >
        <SheetContent className="w-full max-w-none gap-0 sm:w-112 sm:max-w-none">
          {gone ? null : <MemoryEditorForm key={session} memory={memory} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

/**
 * The editor of one opening: a head that names the memory, the text, and the
 * button that keeps it. Enter with Command or Control keeps it too. After a
 * save that failed it opens again with the words the learner wrote.
 */
function MemoryEditorForm({ memory }: { memory: Memory | undefined }) {
  const t = useTranslations("Memory");
  const auth = useTranslations("Auth");
  const close = useMemoryPage((state) => state.close);
  const restored = useMemoryPage((state) => state.draft);
  const { add, edit } = useMemoryActions();
  const [starting] = useState(() => restored ?? memory?.text ?? "");
  const [text, setText] = useState(starting);
  const ready = canSave(text);

  /** Sends the words to the server, unless they are not fit to keep or did not change. */
  function save() {
    if (!ready) {
      return;
    }

    const words = Str.trim(text);

    close();

    if (memory === undefined) {
      add({ text: words });
      return;
    }

    if (words !== memory.text) {
      edit({ id: memory.id, text: words });
    }
  }

  return (
    <>
      <SheetHeader className="border-b pe-12">
        <SheetTitle>{memory ? t("edit") : t("new")}</SheetTitle>
        {memory ? (
          <SheetDescription className="truncate">
            <MemoryFacts memory={memory} />
          </SheetDescription>
        ) : null}
      </SheetHeader>
      <Editor
        defaultValue={starting}
        labels={{
          bold: t("bold"),
          bullets: t("bullets"),
          italic: t("italic"),
          numbers: t("numbers"),
          text: t("text"),
        }}
        limit={MEMORY_TEXT_LIMIT}
        onChange={setText}
        onSubmit={save}
        placeholder={t("placeholder")}
      />
      <SheetFooter className="flex-row justify-end border-t">
        <Button disabled={!ready} onClick={save}>
          {auth("save")}
        </Button>
      </SheetFooter>
    </>
  );
}
