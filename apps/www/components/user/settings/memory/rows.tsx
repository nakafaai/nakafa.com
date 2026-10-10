"use client";

import { AiBrain01Icon } from "@hugeicons/core-free-icons";
import { CardContent } from "@repo/design-system/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import { shownMemories } from "@/components/user/settings/memory/list";
import {
  useMemory,
  useMemoryPage,
} from "@/components/user/settings/memory/provider";
import { MemoryRow } from "@/components/user/settings/memory/row";

/**
 * The body of the list: the memories that match the search, newest first, in
 * a box that scrolls once they are many. The box is a column, so the list
 * inside it can never grow past the box and over the foot of the card. With
 * nothing to list it shows why.
 */
export function MemoryRows() {
  const list = useMemory((current) => current);
  const query = useMemoryPage((state) => state.query);
  const shown = shownMemories(list, query);

  return (
    <CardContent className="border-t px-0">
      {shown.length > 0 ? (
        <ScrollArea className="flex h-auto max-h-96 flex-col" scrollFade>
          <ul className="divide-y">
            {Arr.map(shown, (memory) => (
              <MemoryRow key={memory.id} memory={memory} />
            ))}
          </ul>
        </ScrollArea>
      ) : (
        <MemoryEmpty searching={list.memories.length > 0} />
      )}
    </CardContent>
  );
}

/** Says that there is nothing to list: no memory yet, or none that matches the search. */
function MemoryEmpty({ searching }: { searching: boolean }) {
  const t = useTranslations("Memory");

  return (
    <Empty className="md:p-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeIcons icon={AiBrain01Icon} />
        </EmptyMedia>
        <EmptyTitle className="text-base">
          {searching ? t("no-result") : t("empty")}
        </EmptyTitle>
        {searching ? null : (
          <EmptyDescription>{t("empty-description")}</EmptyDescription>
        )}
      </EmptyHeader>
    </Empty>
  );
}
