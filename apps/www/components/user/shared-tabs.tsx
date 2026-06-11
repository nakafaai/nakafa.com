import type { IconSvgElement } from "@hugeicons/react";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Tabs,
  TabsList,
  TabsTab,
} from "@repo/design-system/components/ui/tabs";
import { Link } from "@repo/internationalization/src/navigation";

interface Props {
  defaultValue: string;
  tabs: {
    label: string;
    href: string;
    icon: IconSvgElement;
  }[];
}

export function SharedTabs({ tabs, defaultValue }: Props) {
  return (
    <nav className="scrollbar-hide sticky top-18 z-40 flex overflow-x-auto rounded-xl border bg-card p-1 shadow-xs lg:top-2">
      <Tabs className="contents" defaultValue={defaultValue}>
        <TabsList className="bg-transparent p-0 [&_[data-slot=tab-indicator]]:bg-accent">
          {tabs.map((tab) => (
            <TabsTab
              className="h-8 px-3 text-muted-foreground data-active:text-accent-foreground"
              key={tab.href}
              nativeButton={false}
              render={
                <Link href={tab.href} prefetch>
                  <HugeIcons className="size-4 shrink-0" icon={tab.icon} />
                  {tab.label}
                </Link>
              }
              value={tab.href}
            />
          ))}
        </TabsList>
      </Tabs>
    </nav>
  );
}
