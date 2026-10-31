import { CommandIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Kbd, KbdGroup } from "@repo/design-system/components/ui/kbd";

/**
 * The keys that open a search palette, Command or Control with K, as two keys of the design system's one grid.
 * Every search trigger shows them, on a wide screen only.
 */
export function SearchShortcut({ className }: { className?: string }) {
  return (
    <KbdGroup className={className}>
      <Kbd>
        <HugeIcons icon={CommandIcon} />
        <span className="sr-only">Command/Ctrl</span>
      </Kbd>
      <Kbd>K</Kbd>
    </KbdGroup>
  );
}
