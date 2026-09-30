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
import { slugify } from "@repo/utilities/slug";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
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
          {heading.children.map((child) => (
            <SidebarTreeItem heading={child} key={child.href} />
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

/**
 * Links one heading: a fragment link for headings in the document, or a
 * button that scrolls the page's virtualizer to a heading it has not rendered.
 */
export function SidebarTreeEntry({ heading }: { heading: ParsedHeading }) {
  const id = slugify(heading.label);
  const virtualIndex = heading.index;
  // Each heading selects only its own state, so an active-heading change
  // re-renders the headings that change instead of the whole outline.
  const isActive = useToc(
    (context) =>
      virtualIndex === undefined && context.activeHeadings.includes(id)
  );
  const scrollToIndex = useVirtual((context) => context.scrollToIndex);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <SidebarMenuButton
            isActive={isActive}
            render={
              virtualIndex === undefined ? (
                // In-page headings use native fragment navigation so an
                // existing hash never enters the route prefetch cache.
                <a href={heading.href} title={heading.label}>
                  <SidebarTreeLabel label={heading.label} />
                </a>
              ) : (
                <button
                  aria-label={heading.label}
                  onClick={() => {
                    scrollToIndex(virtualIndex);
                  }}
                  type="button"
                >
                  <SidebarTreeLabel label={heading.label} />
                </button>
              )
            }
          />
        }
      />
      <TooltipContent
        align="center"
        className="hidden max-w-xs sm:block"
        side="left"
      >
        {heading.label}
      </TooltipContent>
    </Tooltip>
  );
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
          {data.map((item) => (
            <SidebarTreeItem heading={item} key={item.href} />
          ))}
        </TocProvider>
      </SidebarMenu>
    </SidebarTreeGroup>
  );
}
