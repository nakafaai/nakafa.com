import {
  Tabs,
  TabsList,
  TabsTab,
} from "@repo/design-system/components/ui/tabs";
import { Link } from "@repo/internationalization/src/navigation";
import { Array as Arr } from "effect";

interface Props {
  tabs: {
    label: string;
    href: string;
  }[];
  value: string;
}

/** The tabs of a profile: underlined, of equal width, with their labels only. */
export function SharedTabs({ tabs, value }: Props) {
  return (
    <nav className="sticky top-18 z-40 bg-background lg:top-2">
      <Tabs className="contents" value={value}>
        <TabsList className="w-full" variant="underline">
          {Arr.map(tabs, (tab) => (
            <TabsTab
              className="flex-1 text-muted-foreground data-active:text-foreground"
              key={tab.href}
              nativeButton={false}
              render={<Link href={tab.href}>{tab.label}</Link>}
              value={tab.href}
            />
          ))}
        </TabsList>
      </Tabs>
    </nav>
  );
}
