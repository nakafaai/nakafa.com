"use client";

import { Menu02Icon } from "@hugeicons/core-free-icons";
import type { ParsedHeading } from "@repo/contents/_types/toc";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
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
import { slugify } from "@repo/design-system/lib/routing/slug";
import { useTranslations } from "next-intl";
import { TocProvider, useToc } from "@/lib/context/use-toc";
import { useVirtual } from "@/lib/context/use-virtual";

interface Props {
  data: ParsedHeading[];
  title?: string;
}

/**
 * Recursive component to render nested headings
 */
function SidebarTreeItem({ heading }: { heading: ParsedHeading }) {
  const activeHeadings = useToc((context) => context.activeHeadings);
  const scrollToIndex = useVirtual((context) => context.scrollToIndex);

  const id = slugify(heading.label);
  const virtualIndex = heading.index;
  const isActive = virtualIndex === undefined && activeHeadings.includes(id);

  return (
    <SidebarMenuItem key={heading.href}>
      <Tooltip>
        <TooltipTrigger
          render={
            <SidebarMenuButton
              isActive={isActive}
              render={
                virtualIndex === undefined ? (
                  <NavigationLink href={heading.href} title={heading.label} />
                ) : (
                  <button
                    aria-label={heading.label}
                    onClick={() => {
                      scrollToIndex(virtualIndex);
                    }}
                    type="button"
                  />
                )
              }
            >
              <span className="truncate" title={heading.label}>
                {heading.label}
              </span>
            </SidebarMenuButton>
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
 * A component that displays a list of links to the sections of the page.
 * @param data - The data to display, typically generated from the `getHeadings` function.
 */
export function SidebarTree({ data, title }: Props) {
  const t = useTranslations("Common");

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="gap-2">
        <HugeIcons icon={Menu02Icon} />
        {title ?? t("on-this-page")}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <TocProvider toc={data}>
            {data.map((item) => (
              <SidebarTreeItem heading={item} key={item.href} />
            ))}
          </TocProvider>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
