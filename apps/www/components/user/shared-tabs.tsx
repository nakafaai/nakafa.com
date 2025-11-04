import { Highlight } from "@repo/design-system/components/animate-ui/primitives/effects/highlight";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import type { ComponentType, SVGProps } from "react";

type Props = {
  tabs: {
    label: string;
    href: string;
    icon: ComponentType<SVGProps<SVGSVGElement>>;
  }[];
  defaultValue: string;
};

export function SharedTabs({ tabs, defaultValue }: Props) {
  return (
    <div className="scrollbar-hide flex overflow-x-auto rounded-xl border p-1 shadow-xs">
      <Highlight
        className="inset-0 rounded-lg bg-accent"
        defaultValue={defaultValue}
      >
        {tabs.map((tab) => (
          <NavigationLink
            className="flex h-8 cursor-pointer items-center gap-2 rounded-lg px-3 text-muted-foreground text-sm transition-colors data-[active=true]:text-accent-foreground"
            data-value={tab.href}
            href={tab.href}
            key={tab.href}
          >
            <tab.icon className="size-4 shrink-0" />
            {tab.label}
          </NavigationLink>
        ))}
      </Highlight>
    </div>
  );
}
