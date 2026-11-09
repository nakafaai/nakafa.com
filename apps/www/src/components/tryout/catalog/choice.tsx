import type { IconSvgElement } from "@hugeicons/react";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@repo/design-system/components/ui/select";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { TryoutPageLink } from "@/components/tryout/route/link";

/**
 * One select of a try-out catalog header, such as the exam or the group: its
 * trigger shows the current choice's icon, and its title from the small
 * breakpoint, and each choice links to the page it opens.
 */
export function TryoutCatalogChoice({
  current,
  entries,
  label,
  menuLabel,
}: {
  /** The choice of the page on screen, none when no choice is the page's. */
  current: Option.Option<{
    readonly icon: IconSvgElement;
    readonly title: string;
    readonly value: string;
  }>;
  /** Each choice: its icon, its title, its value, and the page it opens. */
  entries: readonly {
    readonly icon: IconSvgElement;
    readonly publicPath: string;
    readonly title: string;
    readonly value: string;
  }[];
  /** The trigger's accessible name. */
  label: string;
  /** The one-word label of the menu. */
  menuLabel: string;
}) {
  return (
    <Select
      items={Arr.map(entries, (entry) => ({
        label: entry.title,
        value: entry.value,
      }))}
      value={Option.getOrNull(Option.map(current, (entry) => entry.value))}
    >
      <SelectTrigger
        aria-label={label}
        className="w-auto min-w-0 sm:max-w-44 lg:max-w-56"
      >
        <span
          className="flex min-w-0 items-center gap-2"
          data-slot="select-value"
        >
          {Option.match(current, {
            onNone: () => <span className="truncate">{label}</span>,
            onSome: (entry) => (
              <>
                <HugeIcons className="size-4 shrink-0" icon={entry.icon} />
                <span className="truncate max-sm:sr-only">{entry.title}</span>
              </>
            ),
          })}
        </span>
      </SelectTrigger>
      <SelectContent
        align="end"
        alignItemWithTrigger={false}
        className="max-w-(--available-width) sm:w-max sm:min-w-(--anchor-width)"
        label={menuLabel}
      >
        {Arr.map(entries, (entry) => (
          <SelectItem
            icon={entry.icon}
            key={entry.value}
            render={<TryoutPageLink publicPath={entry.publicPath} />}
            value={entry.value}
          >
            <span className="min-w-0 leading-snug whitespace-normal sm:whitespace-nowrap">
              {entry.title}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Holds the selects of a catalog header together at the end of its row, the exam
 * first and its group beside it, so the header keeps its path, then its choices.
 */
export function TryoutCatalogChoices({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 items-center gap-2">{children}</div>;
}
