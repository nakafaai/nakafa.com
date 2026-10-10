"use client";

import { CardSection } from "@/components/shared/card/section";
import { MemoryHeader } from "@/components/user/settings/memory/header";
import type { MemoryList } from "@/components/user/settings/memory/list";
import { MemoryProvider } from "@/components/user/settings/memory/provider";
import { MemoryRows } from "@/components/user/settings/memory/rows";
import { MemoryToolbar } from "@/components/user/settings/memory/toolbar";

/**
 * Renders the Memory page from the memories the settings route already read,
 * and the moment it read them: the switch that pauses memory, and the
 * memories to search, add, change and delete.
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
      <MemoryHeader />
      <CardSection>
        <MemoryToolbar />
        <MemoryRows />
      </CardSection>
    </MemoryProvider>
  );
}
