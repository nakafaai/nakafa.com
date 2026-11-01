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
 * The tabs of a profile, in the one tab bar, of equal width across the column as in
 * Threads. They stay right under the app's header while the rows scroll beneath them.
 * Each tab is warmed, so a press finds its page in hand.
 */
export function SharedTabs({ tabs, value }: Props) {
  return (
    <nav className="bg-background sticky top-[var(--app-header-top,4rem)] z-10 lg:top-0">
      <Tabs className="contents" value={value}>
        <TabsList className="gap-0">
          {Arr.map(tabs, (tab) => (
            <TabsTab
              className="flex-1 justify-center"
              key={tab.key}
              nativeButton={false}
              render={
                <Link data-warm="" {...tab.target}>
                  {tab.label}
                </Link>
              }
              value={tab.key}
            />
          ))}
        </TabsList>
      </Tabs>
    </nav>
  );
}
