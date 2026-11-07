import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { Array as Arr, Option } from "effect";
import { Fragment, type ReactNode } from "react";
import { useTranslations } from "use-intl";

/**
 * A list of values in one cell, such as a member's roles: the first on the row's one line and a `+N` badge for the
 * rest, so a cell never wraps and a row never grows. Hovering or pressing `+N`, a phone's tap included, opens every
 * value of the list beside it. Each value draws through `children`, the same way in the row and in the popover.
 */
export function TableList<TItem extends string>({
  children,
  items,
}: {
  /** How one value draws, such as its badge. */
  children: (item: TItem) => ReactNode;
  items: readonly TItem[];
}) {
  const t = useTranslations("DataTable");
  const rest = items.length - 1;

  return Option.match(Arr.head(items), {
    onNone: () => null,
    onSome: (first) => (
      <span className="inline-flex max-w-full items-center gap-1 align-middle">
        <span className="flex min-w-0">{children(first)}</span>
        {rest > 0 ? (
          <Popover>
            <Badge
              aria-label={t("more", { count: rest })}
              render={<PopoverTrigger openOnHover />}
              variant="outline"
            >
              +{rest}
            </Badge>
            <PopoverContent className="w-auto max-w-72 p-2">
              <span className="flex flex-wrap gap-1">
                {Arr.map(items, (item) => (
                  <Fragment key={item}>{children(item)}</Fragment>
                ))}
              </span>
            </PopoverContent>
          </Popover>
        ) : null}
      </span>
    ),
  });
}
