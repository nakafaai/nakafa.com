"use client";

import { CardContent } from "@repo/design-system/components/ui/card";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import { MemoryEditor } from "@/components/user/settings/memory/editor";
import { shownMemories } from "@/components/user/settings/memory/list";
import {
  useMemory,
  useMemoryPage,
} from "@/components/user/settings/memory/provider";
import { MemoryRow } from "@/components/user/settings/memory/row";

/**
 * Lists the memories that match the search, newest first, with the editor of
 * a new memory on top while the learner writes one. When there is nothing to
 * list it says why in plain words.
 */
export function MemoryRows() {
  const t = useTranslations("Memory");
  const list = useMemory((current) => current);
  const { adding, query } = useMemoryPage((state) => ({
    adding: state.adding,
    query: state.query,
  }));
  const shown = shownMemories(list, {
    label: (kind) => t(`kind-${kind}`),
    query,
  });
  const hasMemories = list.memories.length > 0;

  return (
    <CardContent className="border-t px-0">
      {adding || shown.length > 0 ? (
        <ul className="divide-y">
          {adding ? (
            <li className="px-6 py-3">
              <MemoryEditor />
            </li>
          ) : null}
          {Arr.map(shown, (memory) => (
            <MemoryRow key={memory.id} memory={memory} />
          ))}
        </ul>
      ) : (
        <p className="px-6 pt-4 text-muted-foreground text-sm">
          {hasMemories ? t("no-result") : t("empty")}
        </p>
      )}
    </CardContent>
  );
}
