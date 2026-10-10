"use client";

import { Delete02Icon, Edit02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import { useMemoryActions } from "@/components/user/settings/memory/actions.client";
import { MemoryFacts } from "@/components/user/settings/memory/facts";
import {
  isPending,
  type Memory,
  memoryName,
} from "@/components/user/settings/memory/list";
import { useMemoryPage } from "@/components/user/settings/memory/provider";

/**
 * One memory in the list: its title, or its words when it has none, and its
 * facts, each on one line. A press opens it in the editor, where the whole
 * text is. The actions show while the pointer or the focus is on the row, and
 * always on a touch screen.
 */
export function MemoryRow({ memory }: { memory: Memory }) {
  const t = useTranslations("Memory");
  const openEdit = useMemoryPage((state) => state.openEdit);
  const selected = useMemoryPage(
    (state) => state.open && state.target === memory.id
  );
  const { remove } = useMemoryActions();
  // A memory the server has not stored yet has no id to change.
  const waiting = isPending(memory);

  return (
    <li
      className="group/row flex items-center gap-1 pe-4 transition-colors ease-out focus-within:bg-muted/50 hover:bg-muted/50 data-selected:bg-muted/50"
      data-selected={selected ? "" : undefined}
    >
      <button
        className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1 py-4 ps-(--card-spacing) text-start outline-none disabled:cursor-default"
        disabled={waiting}
        onClick={() => openEdit(memory.id)}
        type="button"
      >
        <span className="truncate text-sm">{memoryName(memory)}</span>
        <span className="truncate text-muted-foreground text-xs">
          <MemoryFacts memory={memory} />
        </span>
      </button>
      <div className="flex shrink-0 items-center opacity-0 pointer-coarse:opacity-100 transition-opacity ease-out group-focus-within/row:opacity-100 group-hover/row:opacity-100">
        <Button
          disabled={waiting}
          onClick={() => openEdit(memory.id)}
          size="icon-sm"
          variant="ghost"
        >
          <HugeIcons icon={Edit02Icon} />
          <span className="sr-only">{t("edit")}</span>
        </Button>
        <Button
          disabled={waiting}
          onClick={() => remove(memory)}
          size="icon-sm"
          variant="ghost"
        >
          <HugeIcons icon={Delete02Icon} />
          <span className="sr-only">{t("delete")}</span>
        </Button>
      </div>
    </li>
  );
}
