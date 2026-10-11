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
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import { useMemory } from "@/components/user/settings/memory/provider";
import { MemoryRow } from "@/components/user/settings/memory/row";

/**
 * The body of the list: the memories that match the search, newest first, in
 * a box that scrolls once they are many. With nothing to list it shows why.
 */
export function MemoryRows() {
  const listed = useMemory(
    ({ more, shown }) => shown.length > 0 || more !== null
  );

  return (
    <CardContent className="border-t px-0">
      {listed ? <MemoryList /> : <MemoryEmpty />}
    </CardContent>
  );
}

/**
 * The rows in their box. The box is a column, so the list inside it can never
 * grow past it. The end of the list sits inside the box, because the box is
 * what scrolls.
 */
function MemoryList() {
  const shown = useMemory((reading) => reading.shown);

  return (
    <ScrollArea className="flex h-auto max-h-96 flex-col" scrollFade>
      <ul className="divide-y">
        {Arr.map(shown, (memory) => (
          <MemoryRow key={memory.id} memory={memory} />
        ))}
      </ul>
      <MemoryEnd />
    </ScrollArea>
  );
}

/** The end of the list: when it comes into view, the next page loads. */
function MemoryEnd() {
  const more = useMemory((reading) => reading.more);

  return more ? <Intersection onIntersect={more} /> : null;
}

/**
 * Says that there is nothing to list: no memory yet, or none that matches the
 * search. While a search waits for the server's answer it says nothing yet.
 */
function MemoryEmpty() {
  const t = useTranslations("Memory");
  const { empty, nothing } = useMemory((reading) => ({
    empty: reading.empty,
    nothing: reading.nothing,
  }));

  if (!(empty || nothing)) {
    return null;
  }

  return (
    <Empty className="md:p-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeIcons icon={AiBrain01Icon} />
        </EmptyMedia>
        <EmptyTitle className="text-base">
          {empty ? t("empty") : t("no-result")}
        </EmptyTitle>
        {empty ? (
          <EmptyDescription>{t("empty-description")}</EmptyDescription>
        ) : null}
      </EmptyHeader>
    </Empty>
  );
}
