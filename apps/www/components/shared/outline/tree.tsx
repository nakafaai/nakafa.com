"use client";

import { Menu02Icon } from "@hugeicons/core-free-icons";
import type { ParsedHeading } from "@repo/contents/toc";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@repo/design-system/components/ui/sidebar-content";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { SidebarMenuSub } from "@repo/design-system/components/ui/sidebar-submenu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { useSidebar } from "@repo/design-system/lib/sidebar/context";
import { slugify } from "@repo/utilities/slug";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import { TocProvider, useToc } from "@/components/shared/outline/context";
import { useVirtual } from "@/lib/content/virtual";

interface Props {
  data: ParsedHeading[];
  title?: string;
}

/** Keeps outline labels on one line while exposing their complete title. */
function SidebarTreeLabel({ label }: Pick<ParsedHeading, "label">) {
  return (
    <span className="truncate" title={label}>
      {label}
    </span>
  );
}

/** Renders one heading and its nested headings. */
function SidebarTreeItem({ heading }: { heading: ParsedHeading }) {
  return (
    <SidebarMenuItem>
      <SidebarTreeEntry heading={heading} />
      {!!heading.children && heading.children.length > 0 && (
        <SidebarMenuSub>
          {Arr.map(heading.children, (child) => (
            <SidebarTreeItem heading={child} key={child.href} />
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

/** Shows a heading's complete label beside its outline entry. */
function SidebarTreeTooltip({
  children,
  label,
}: {
  children: ReactElement;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent
        align="center"
        className="hidden max-w-xs sm:block"
        side="left"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Whether the reading band holds a heading. Each entry selects only its own
 * state, so an active-heading change re-renders the entries that change
 * instead of the whole outline.
 */
function useActiveHeading({ label }: Pick<ParsedHeading, "label">) {
  const id = slugify(label);
  return useToc((context) => context.activeHeadings.includes(id));
}

/**
 * Links a heading in the document. Native fragment navigation reaches it, so
 * an existing hash never enters the route prefetch cache.
 */
function SidebarTreeLink({ heading }: { heading: ParsedHeading }) {
  const isActive = useActiveHeading(heading);
  // Below the desktop width the outline is a sheet over the page, so choosing
  // an entry closes it and the reader sees where they jumped.
  const setOpenMobile = useSidebar((sidebar) => sidebar.setOpenMobile);

  return (
    <SidebarTreeTooltip label={heading.label}>
      <SidebarMenuButton
        isActive={isActive}
        render={
          <a
            href={heading.href}
            onClick={() => setOpenMobile(false)}
            title={heading.label}
          >
            <SidebarTreeLabel label={heading.label} />
          </a>
        }
      />
    </SidebarTreeTooltip>
  );
}

/** Scrolls the page's virtualizer to a heading it has not rendered. */
function SidebarTreeJump({
  heading,
  index,
}: {
  heading: ParsedHeading;
  index: number;
}) {
  const isActive = useActiveHeading(heading);
  const scrollToIndex = useVirtual((context) => context.scrollToIndex);
  const setOpenMobile = useSidebar((sidebar) => sidebar.setOpenMobile);

  return (
    <SidebarTreeTooltip label={heading.label}>
      <SidebarMenuButton
        isActive={isActive}
        render={
          <button
            aria-label={heading.label}
            onClick={() => {
              scrollToIndex(index);
              setOpenMobile(false);
            }}
            type="button"
          >
            <SidebarTreeLabel label={heading.label} />
          </button>
        }
      />
    </SidebarTreeTooltip>
  );
}

/**
 * Links one heading: a fragment link for headings in the document, or a
 * button that scrolls the page's virtualizer to a heading it has not rendered.
 */
export function SidebarTreeEntry({ heading }: { heading: ParsedHeading }) {
  if (heading.index === undefined) {
    return <SidebarTreeLink heading={heading} />;
  }

  return <SidebarTreeJump heading={heading} index={heading.index} />;
}

/** Frames an outline under its labeled group heading. */
export function SidebarTreeGroup({
  children,
  title,
}: {
  children: ReactNode;
  title?: string | undefined;
}) {
  const t = useTranslations("Common");

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="gap-2">
        <HugeIcons icon={Menu02Icon} />
        {title ?? t("on-this-page")}
      </SidebarGroupLabel>
      <SidebarGroupContent>{children}</SidebarGroupContent>
    </SidebarGroup>
  );
}

/**
 * Lists links to the sections of the page.
 * @param data - The headings, typically generated from the `getHeadings` function.
 */
export function SidebarTree({ data, title }: Props) {
  return (
    <SidebarTreeGroup title={title}>
      <SidebarMenu>
        <TocProvider toc={data}>
          {Arr.map(data, (item) => (
            <SidebarTreeItem heading={item} key={item.href} />
          ))}
        </TocProvider>
      </SidebarMenu>
    </SidebarTreeGroup>
  );
}
