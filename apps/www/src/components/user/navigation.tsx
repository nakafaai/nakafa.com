import {
  Tabs,
  TabsList,
  TabsTab,
} from "@repo/design-system/components/ui/tabs";
import { Array as Arr } from "effect";
import { Link, type LinkTarget } from "@/lib/routing/link";

interface Props {
  tabs: readonly {
    readonly key: string;
    readonly label: string;
    readonly target: LinkTarget;
  }[];
  value: string;
}

/**
 * The tabs of a profile: underlined, of equal width, with their labels only, on
 * a hairline that runs the width of the column, as in Threads. They stay right
 * under the app's header while the rows scroll beneath them.
 */
export function SharedTabs({ tabs, value }: Props) {
  return (
    <nav className="sticky top-[var(--app-header-top,4rem)] z-10 bg-background lg:top-0">
      <Tabs className="contents" value={value}>
        <TabsList className="w-full border-b" variant="underline">
          {Arr.map(tabs, (tab) => (
            <TabsTab
              className="flex-1"
              key={tab.key}
              nativeButton={false}
              render={<Link {...tab.target}>{tab.label}</Link>}
              value={tab.key}
            />
          ))}
        </TabsList>
      </Tabs>
    </nav>
  );
}
