import { Highlight } from "@repo/design-system/components/animate-ui/primitives/effects/highlight";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import type { ComponentType, SVGProps } from "react";

type Props = {
  tabs: {
    label: string;
    href: string;
    icon: ComponentType<SVGProps<SVGSVGElement>>;
  }[];
};

export function SharedTabs({ tabs }: Props) {
  return (
    <div className="flex rounded-xl border p-1 shadow-sm">
      <Highlight
        className="inset-0 rounded-lg bg-accent"
        defaultValue={tabs[0]?.href}
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
