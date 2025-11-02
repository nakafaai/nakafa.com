"use client";

import type { ParsedHeading } from "@repo/contents/_types/toc";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from "@repo/design-system/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { slugify } from "@repo/design-system/lib/utils";
import { AlignLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { TocProvider, useToc } from "@/lib/context/use-toc";
import { useVirtual } from "@/lib/context/use-virtual";

type Props = {
  data: ParsedHeading[];
  title?: string;
};

/**
 * Recursive component to render nested headings
 */
function SidebarTreeItem({
  heading,
  depth = 0,
}: {
  heading: ParsedHeading;
  depth?: number;
}) {
  const activeHeadings = useToc((context) => context.activeHeadings);
  const scrollToIndex = useVirtual((context) => context.scrollToIndex);

  const id = slugify(heading.label);

  const hasIndex = heading.index !== undefined;
  // TODO: disable isActive when hasIndex until fix is coming
  const isActive = activeHeadings.includes(id) && !hasIndex;

  return (
    <SidebarMenuItem key={heading.href}>
      <Tooltip>
        <TooltipTrigger
          render={
            <SidebarMenuButton asChild isActive={isActive}>
              {hasIndex ? (
                <button
                  onClick={() => {
                    if (heading.index !== undefined) {
                      scrollToIndex(heading.index);
                    }
                  }}
                  type="button"
                >
                  <span className="truncate" title={heading.label}>
                    {heading.label}
                  </span>
                </button>
              ) : (
                <NavigationLink href={heading.href} title={heading.label}>
                  <span className="truncate" title={heading.label}>
                    {heading.label}
                  </span>
                </NavigationLink>
              )}
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

      {heading.children && heading.children.length > 0 && (
        <SidebarMenuSub>
          {heading.children.map((child) => (
            <SidebarTreeItem
              depth={depth + 1}
              heading={child}
              key={child.href}
            />
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
        <AlignLeftIcon />
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
