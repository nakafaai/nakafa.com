import type { IconSvgElement } from "@hugeicons/react";
import { Highlight } from "@repo/design-system/components/animate-ui/primitives/effects/highlight";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";

interface Props {
  tabs: {
    label: string;
    href: string;
    icon: IconSvgElement;
  }[];
  defaultValue: string;
}

export function SharedTabs({ tabs, defaultValue }: Props) {
  return (
    <nav className="scrollbar-hide sticky top-18 z-40 flex overflow-x-auto rounded-xl border bg-card p-1 shadow-xs lg:top-2">
      <Highlight
        className="inset-0 rounded-md bg-accent"
        defaultValue={defaultValue}
      >
        {tabs.map((tab) => (
          <NavigationLink
            className="flex h-8 cursor-pointer items-center gap-2 rounded-lg px-3 text-muted-foreground text-sm transition-colors data-[active=true]:text-accent-foreground"
            data-value={tab.href}
            href={tab.href}
            key={tab.href}
          >
            <HugeIcons className="size-4 shrink-0" icon={tab.icon} />
            {tab.label}
          </NavigationLink>
        ))}
      </Highlight>
    </nav>
  );
}
