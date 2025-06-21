"use client";

import { TocProvider, useToc } from "@/lib/context/use-toc";
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
import { useTranslations } from "next-intl";

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
}: { heading: ParsedHeading; depth?: number }) {
  const activeHeadings = useToc((context) => context.activeHeadings);

  const id = slugify(heading.label);

  return (
    <SidebarMenuItem key={heading.href}>
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarMenuButton asChild isActive={activeHeadings.includes(id)}>
            <NavigationLink href={heading.href} title={heading.label}>
              <span title={heading.label} className="truncate">
                {heading.label}
              </span>
            </NavigationLink>
          </SidebarMenuButton>
        </TooltipTrigger>
        <TooltipContent
          side="left"
          align="center"
          className="hidden max-w-xs sm:block"
        >
          {heading.label}
        </TooltipContent>
      </Tooltip>

      {heading.children && heading.children.length > 0 && (
        <SidebarMenuSub>
          {heading.children.map((child) => (
            <SidebarTreeItem
              key={child.href}
              heading={child}
              depth={depth + 1}
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
      <SidebarGroupLabel>{title ?? t("on-this-page")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <TocProvider toc={data}>
            {data.map((item) => (
              <SidebarTreeItem key={item.href} heading={item} />
            ))}
          </TocProvider>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
