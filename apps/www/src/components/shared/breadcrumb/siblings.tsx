"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { BreadcrumbItem } from "@repo/design-system/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { OptionIcon } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "cn";
import { Array as Arr, Option } from "effect";
import type { ComponentProps } from "react";
import { BreadcrumbAnchor } from "@/components/shared/breadcrumb/anchor";
import type { LinkTarget } from "@/lib/routing/link";

/**
 * Builds the siblings of one crumb: the pages that stand at its place in the path, the crumb's own page among them
 * (`current`), each with the icon of its kind, as every menu option carries one. `label` is the one-word heading
 * that every menu names itself with, read from a `menu-` key. `onChoose` runs when an option is pressed, before its
 * link navigates, such as to remember the learner's country. The shape holds icons and a function, which no Schema
 * describes as data, so it is the parameter of this builder.
 */
export function crumbSiblings(siblings: {
  readonly label: string;
  readonly onChoose?:
    | ((option: { readonly label: string; readonly target: LinkTarget }) => void)
    | undefined;
  readonly options: readonly {
    readonly current: boolean;
    readonly icon: ComponentProps<typeof OptionIcon>["icon"];
    readonly label: string;
    readonly target: LinkTarget;
  }[];
}) {
  return siblings;
}

export type CrumbSiblings = ReturnType<typeof crumbSiblings>;

/** The crumb's own page among its siblings, whose name the crumb shows. */
const currentOf = (siblings: CrumbSiblings) =>
  Arr.findFirst(siblings.options, (option) => option.current);

/**
 * The options of a crumb's menu: one link per sibling, the crumb's own page checked and marked as the current page,
 * so a press is a client navigation that preloads on intent, and the menu closes on it.
 */
function CrumbOptions({ siblings }: { siblings: CrumbSiblings }) {
  return (
    <DropdownMenuRadioGroup
      value={Option.getOrElse(
        Option.map(currentOf(siblings), (option) => option.label),
        () => ""
      )}
    >
      {Arr.map(siblings.options, (option) => (
        <DropdownMenuRadioItem
          aria-current={option.current ? "page" : undefined}
          icon={option.icon}
          key={option.label}
          onClick={() => siblings.onChoose?.(option)}
          render={<BreadcrumbAnchor target={option.target} />}
          value={option.label}
        >
          <span className="min-w-0 truncate" title={option.label}>
            {option.label}
          </span>
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}

/**
 * A crumb that opens its siblings, as Google Drive's path opens a folder's menu: its name and a caret, and a press
 * opens a menu of the pages that stand at its place in the path, at every width. The crumb of the current page is one
 * too, so the path is the page's navigation and its header keeps its one button for the page's own action.
 */
export function BreadcrumbSiblingsSegment({
  className,
  label,
  siblings,
}: {
  className?: string;
  /** The crumb's own name, which the path shows. */
  label: string;
  siblings: CrumbSiblings;
}) {
  return (
    <BreadcrumbItem className={cn("min-w-0", className)} dir="auto">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              className="hover:text-foreground data-popup-open:text-foreground focus-visible:ring-ring flex min-w-0 items-center gap-1 rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
              type="button"
            >
              <span className="min-w-0 truncate">{label}</span>
              <HugeIcons className="size-3.5 shrink-0" icon={ArrowDown01Icon} />
            </button>
          }
        />
        <DropdownMenuContent
          align="start"
          className="w-auto max-w-[calc(100vw-2rem)] min-w-48"
          label={siblings.label}
        >
          <CrumbOptions siblings={siblings} />
        </DropdownMenuContent>
      </DropdownMenu>
    </BreadcrumbItem>
  );
}

/**
 * A folded crumb that has siblings, inside the path's ellipsis menu: a submenu under the icon of the crumb's own page,
 * which opens the same options the crumb opens in the row.
 */
export function BreadcrumbSiblingsSub({
  label,
  siblings,
}: {
  label: string;
  siblings: CrumbSiblings;
}) {
  const current = currentOf(siblings);
  if (Option.isNone(current)) {
    return null;
  }
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger icon={current.value.icon}>
        <span className="min-w-0 truncate" title={label}>
          {label}
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent label={siblings.label}>
        <CrumbOptions siblings={siblings} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
