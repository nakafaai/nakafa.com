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
import { useTranslations } from "next-intl";
import { TocProvider, useToc } from "@/lib/context/use-toc";

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

  const id = slugify(heading.label);

  return (
    <SidebarMenuItem key={heading.href}>
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarMenuButton asChild isActive={activeHeadings.includes(id)}>
            <NavigationLink href={heading.href} title={heading.label}>
              <span className="truncate" title={heading.label}>
                {heading.label}
              </span>
            </NavigationLink>
          </SidebarMenuButton>
        </TooltipTrigger>
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
      <SidebarGroupLabel>{title ?? t("on-this-page")}</SidebarGroupLabel>
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
