import { CardSection } from "@/components/shared/card/section";
import { MemoryControl } from "@/components/user/settings/memory/control";
import { MemoryEditor } from "@/components/user/settings/memory/editor";
import type { MemoryPage } from "@/components/user/settings/memory/list";
import { MemoryProvider } from "@/components/user/settings/memory/provider";
import { MemoryRows } from "@/components/user/settings/memory/rows";
import { MemoryToolbar } from "@/components/user/settings/memory/toolbar";

/**
 * Renders the Memory page from what the settings route already read: the first
 * page of memories, whether memory is paused, and the moment it read them. It
 * shows the card that turns memory on and off, the list of memories, and the
 * editor that opens beside them.
 */
export function UserSettingsMemory({
  first,
  now,
  paused,
}: {
  first: MemoryPage;
  now: number;
  paused: boolean;
}) {
  return (
    <MemoryProvider first={first} now={now} paused={paused}>
      <MemoryControl />
      <CardSection className="gap-0 pb-0">
        <MemoryToolbar />
        <MemoryRows />
      </CardSection>
      <MemoryEditor />
    </MemoryProvider>
  );
}
