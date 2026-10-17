"use client";

import { Delete02Icon, Edit02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Equal, String as Str } from "effect";
import { useTranslations } from "next-intl";
import { memo, useLayoutEffect, useRef } from "react";
import {
  MemoryEnds,
  MemoryOrigin,
} from "@/components/user/settings/memory/facts";
import {
  isPending,
  type Memory,
  memoryName,
} from "@/components/user/settings/memory/list";
import { useMemoryPage } from "@/components/user/settings/memory/provider";

/**
 * The content of one memory in the list: its title, or its words when it has
 * none, and its facts, each on one line. A press opens it in the editor, where
 * the whole text is. The actions show while the pointer or the focus is on the
 * row, and always on a touch screen. The row fills the item the window gives
 * it, which has a fixed height, so every row is as tall as the window expects.
 *
 * The list can hold thousands of memories, so a row renders again only when
 * its own memory or whether it is the one in the editor changes: it subscribes
 * to nothing else, neither the search nor the count of openings of the editor,
 * and a press reads the store when it happens. Every answer of the server
 * hands the page new objects for memories that did not change, so rows compare
 * memories by what they say, not by the object that holds it.
 *
 * A row leaves the page when the window scrolls it out or when the learner
 * deletes it, and a row that holds the focus when that happens would drop it
 * on the page. It hands the focus to the list instead, where the next Tab goes
 * on to a row in view.
 */
export const MemoryRow = memo(
  function MemoryRow({
    askDelete,
    memory,
  }: {
    askDelete: (memory: Memory) => void;
    memory: Memory;
  }) {
    const t = useTranslations("Memory");
    const openEdit = useMemoryPage((state) => state.openEdit);
    const selected = useMemoryPage(
      (state) => state.open && state.target?.id === memory.id
    );
    const row = useRef<HTMLDivElement>(null);
    // A memory the server has not stored yet has no id to change.
    const waiting = isPending(memory);
    const named = memoryName(memory);
    // Words that show nothing, such as a divider alone, have no name to show.
    const name = Str.isEmpty(named) ? t("untitled") : named;

    // The cleanup runs before the row leaves the page, while the focus is in it.
    useLayoutEffect(
      () => () => {
        if (row.current?.contains(document.activeElement)) {
          row.current.closest("ul")?.focus({ preventScroll: true });
        }
      },
      []
    );

    return (
      <div
        className="group/row flex h-full items-center gap-1 pe-4 transition-colors ease-out focus-within:bg-muted/50 hover:bg-muted/50 data-selected:bg-muted/50"
        data-selected={selected ? "" : undefined}
        ref={row}
      >
        <button
          className="flex h-full min-w-0 flex-1 cursor-pointer flex-col justify-center gap-1 ps-(--card-spacing) text-start outline-none disabled:cursor-default"
          disabled={waiting}
          onClick={() => openEdit(memory)}
          type="button"
        >
          {/* The name follows the direction of its own words, and a name too
              long for the row keeps its start and its whole text in the title. */}
          <span className="truncate text-sm" dir="auto" title={name}>
            {name}
          </span>
          {/* A row says one fact: when a situation ends, the one fact a learner
              must not lose, and otherwise who wrote the memory. */}
          <span className="truncate text-muted-foreground text-xs">
            {memory.validUntil === undefined ? (
              <MemoryOrigin memory={memory} />
            ) : (
              <MemoryEnds validUntil={memory.validUntil} />
            )}
          </span>
        </button>
        <div className="flex shrink-0 items-center opacity-0 pointer-coarse:opacity-100 transition-opacity ease-out group-focus-within/row:opacity-100 group-hover/row:opacity-100">
          <Button
            disabled={waiting}
            onClick={() => openEdit(memory)}
            size="icon-sm"
            variant="ghost"
          >
            <HugeIcons icon={Edit02Icon} />
            <span className="sr-only">{t("edit")}</span>
          </Button>
          <Button
            disabled={waiting}
            onClick={() => askDelete(memory)}
            size="icon-sm"
            variant="ghost"
          >
            <HugeIcons icon={Delete02Icon} />
            <span className="sr-only">{t("delete")}</span>
          </Button>
        </div>
      </div>
    );
  },
  (before, after) =>
    before.askDelete === after.askDelete &&
    Equal.equals(before.memory, after.memory)
);
