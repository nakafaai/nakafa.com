import { useTranslations } from "next-intl";
import NavigationLink from "../ui/navigation-link";
import {
  SidebarGroupLabel,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";

import { SidebarMenu } from "../ui/sidebar";

import { SidebarGroup } from "../ui/sidebar";
import { SidebarMenuSub } from "../ui/sidebar";

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
  return (
    <SidebarMenuItem key={heading.href}>
      <SidebarMenuButton tooltip={heading.label} asChild>
        <NavigationLink href={heading.href}>
          <span title={heading.label} className="truncate">
            {heading.label}
          </span>
        </NavigationLink>
      </SidebarMenuButton>

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
      <SidebarMenu>
        {data.map((item) => (
          <SidebarTreeItem key={item.href} heading={item} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
