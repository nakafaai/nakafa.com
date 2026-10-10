"use client";

import {
  MEMORY_TEXT_LIMIT,
  NinaMemoryKind,
} from "@repo/backend/confect/nina/memory.spec";
import {
  EditorFrame,
  EditorStatic,
} from "@repo/design-system/components/editor/frame";
import {
  canSaveText,
  flattenText,
} from "@repo/design-system/components/editor/text";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Array as Arr, String as Str } from "effect";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { createContext, use, useState } from "react";
import { useMemoryActions } from "@/components/user/settings/memory/actions.client";
import type { Memory } from "@/components/user/settings/memory/list";
import { useMemoryPage } from "@/components/user/settings/memory/provider";

/** The words in the editor's box, which the box shows while the editor loads. */
const DraftText = createContext("");

/**
 * Stands in for the editor until its code arrives. It draws the same box with
 * the same words, so the row keeps its height when the editor takes over.
 */
function EditorLoading() {
  return (
    <EditorFrame>
      <EditorStatic>{use(DraftText)}</EditorStatic>
    </EditorFrame>
  );
}

/** The editor loads when a learner opens it, never with the page. */
const Editor = dynamic(
  () =>
    import("@repo/design-system/components/editor/plain").then(
      (module) => module.PlainEditor
    ),
  { loading: EditorLoading, ssr: false }
);

/**
 * Writes one memory in place: the words, and what kind of memory they are. It
 * edits `memory`, or writes a new one when there is none. Enter and Save keep
 * the words, and Escape and Cancel leave them.
 */
export function MemoryEditor({ memory }: { memory?: Memory }) {
  const t = useTranslations("Memory");
  const auth = useTranslations("Auth");
  const common = useTranslations("Common");
  const close = useMemoryPage((state) => state.close);
  const { add, edit } = useMemoryActions();
  const [kind, setKind] = useState(memory?.kind ?? "style");
  const [text, setText] = useState(() => flattenText(memory?.text ?? ""));
  const canSave = canSaveText(text, MEMORY_TEXT_LIMIT);
  const kinds = Arr.map(NinaMemoryKind.literals, (value) => ({
    label: t(`kind-${value}`),
    value,
  }));

  /** Sends the words to the server, unless they are not fit to keep or did not change. */
  function save() {
    if (!canSave) {
      return;
    }

    const draft = { kind, text: Str.trim(text) };

    close();
    if (memory === undefined) {
      add(draft);
      return;
    }
    if (draft.kind !== memory.kind || draft.text !== memory.text) {
      edit({ ...draft, id: memory.id });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <DraftText value={text}>
        <Editor
          label={t("text")}
          limit={MEMORY_TEXT_LIMIT}
          onCancel={close}
          onChange={setText}
          onSubmit={save}
          placeholder={t("placeholder")}
          value={text}
        />
      </DraftText>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Select
            items={kinds}
            onValueChange={(next) => {
              if (next) {
                setKind(next);
              }
            }}
            value={kind}
          >
            <SelectTrigger aria-label={t("kind")} size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Arr.map(kinds, (item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-xs tabular-nums">
            {Str.length(text)} / {MEMORY_TEXT_LIMIT}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={close} size="sm" variant="outline">
            {common("cancel")}
          </Button>
          <Button disabled={!canSave} onClick={save} size="sm">
            {auth("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
