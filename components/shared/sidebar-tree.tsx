"use client";

import { useToc } from "@/lib/context/use-toc";
import { slugify } from "@/lib/utils";
import { useTranslations } from "next-intl";
import NavigationLink from "../ui/navigation-link";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from "../ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export type ParsedHeading = {
  label: string;
  href: string;
  children?: ParsedHeading[];
};

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
  const activeHeading = useToc((context) => context.activeHeading);

  const id = slugify(heading.label);

  return (
    <SidebarMenuItem key={heading.href}>
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarMenuButton asChild isActive={activeHeading === id}>
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
          {data.map((item) => (
            <SidebarTreeItem key={item.href} heading={item} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
