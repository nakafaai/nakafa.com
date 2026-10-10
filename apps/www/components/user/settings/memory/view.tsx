"use client";

import { MEMORY_LIMIT } from "@repo/backend/confect/nina/memory.spec";
import { useTranslations } from "next-intl";
import {
  CardSection,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { MemoryControl } from "@/components/user/settings/memory/control";
import { MemoryEditor } from "@/components/user/settings/memory/editor";
import type { MemoryList } from "@/components/user/settings/memory/list";
import { MemoryProvider } from "@/components/user/settings/memory/provider";
import { MemoryRows } from "@/components/user/settings/memory/rows";
import { MemoryToolbar } from "@/components/user/settings/memory/toolbar";

/**
 * Renders the Memory page from the memories the settings route already read,
 * and the moment it read them: the card that turns memory on and off, the
 * list of memories, and the editor that opens beside them.
 */
export function UserSettingsMemory({
  initialList,
  now,
}: {
  initialList: MemoryList;
  now: number;
}) {
  return (
    <MemoryProvider initial={initialList} now={now}>
      <MemoryControl />
      <CardSection className="gap-0">
        <MemoryToolbar />
        <MemoryRows />
        <MemoryLimit />
      </CardSection>
      <MemoryEditor />
    </MemoryProvider>
  );
}

/** The foot of the list: how many memories a learner can keep. */
function MemoryLimit() {
  const t = useTranslations("Memory");

  return (
    <CardSectionFooter>
      <p className="text-muted-foreground text-sm">
        {t("limit", { count: MEMORY_LIMIT })}
      </p>
    </CardSectionFooter>
  );
}
