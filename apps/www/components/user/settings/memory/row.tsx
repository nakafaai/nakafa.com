"use client";

import { Delete02Icon, Edit02Icon } from "@hugeicons/core-free-icons";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { useMemoryActions } from "@/components/user/settings/memory/actions.client";
import { MemoryEditor } from "@/components/user/settings/memory/editor";
import { isPending, type Memory } from "@/components/user/settings/memory/list";
import {
  useMemoryNow,
  useMemoryPage,
} from "@/components/user/settings/memory/provider";
import {
  formatConfirmed,
  formatEnds,
} from "@/components/user/settings/memory/time";

/** Shows one memory, or its editor while the learner changes it. */
export function MemoryRow({ memory }: { memory: Memory }) {
  const editing = useMemoryPage((state) => state.editing === memory.id);

  return (
    <li className="px-6 py-3">
      {editing ? (
        <MemoryEditor memory={memory} />
      ) : (
        <MemoryView memory={memory} />
      )}
    </li>
  );
}

/** Shows the words of one memory with what is known about them. */
function MemoryView({ memory }: { memory: Memory }) {
  const t = useTranslations("Memory");
  const openEdit = useMemoryPage((state) => state.openEdit);
  const { remove } = useMemoryActions();
  // A memory the server has not stored yet has no id to change.
  const waiting = isPending(memory);

  return (
    <div className="flex items-start gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="wrap-break-word text-sm">{memory.text}</p>
        <MemoryFacts memory={memory} />
      </div>
      <div className="flex shrink-0 items-center">
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
    </div>
  );
}

/**
 * Says what kind of memory it is, who wrote it, when it was last confirmed,
 * when a situation ends, and whether Nina reads it now. The confirmation
 * counts from the moment the server read the page, so the server and the
 * browser render the same words.
 */
function MemoryFacts({ memory }: { memory: Memory }) {
  const t = useTranslations("Memory");
  const locale = useLocale();
  const now = useMemoryNow();
  const origin =
    memory.author === "learner"
      ? t("written-by-you")
      : t("from-chats", { count: memory.sources });
  const facts = Arr.appendAll(
    [
      t(`kind-${memory.kind}`),
      origin,
      t("confirmed", {
        time: formatConfirmed(memory.confirmedAt, now, locale),
      }),
    ],
    memory.validUntil === undefined
      ? []
      : [t("ends", { date: formatEnds(memory.validUntil, locale) })]
  );

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
      <p>{Arr.join(facts, " · ")}</p>
      {memory.inUse ? (
        <Badge variant="default-subtle">{t("in-use")}</Badge>
      ) : null}
    </div>
  );
}
