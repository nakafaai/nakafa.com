"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@repo/design-system/components/ui/sidebar";
import { usePathname } from "@repo/internationalization/src/navigation";
import { useTranslations } from "next-intl";
import { subjectMenu } from "./_data/subject";

/**
 * Renders one subject category inside the app sidebar.
 *
 * We keep the design-system collapsible so the animation stays intact, but we
 * key the collapsible by pathname. This gives Base UI a fresh panel instance on
 * every route change while preserving the logical open/closed choice in React
 * state.
 *
 * References:
 * - Next.js preserving UI state with Cache Components:
 *   `apps/www/node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`
 * - React guidance on simplifying effects when render identity is enough:
 *   https://react.dev/learn/you-might-not-need-an-effect
 * - Mantine `useDisclosure`:
 *   https://mantine.dev/hooks/use-disclosure/
 * - Installed Base UI collapsible panel internals:
 *   `packages/design-system/node_modules/@base-ui/react/esm/collapsible/panel/useCollapsiblePanel.js`
 */
function SubjectMenuItem({ item }: { item: (typeof subjectMenu)[number] }) {
  const pathname = usePathname();
  const t = useTranslations("Subject");
  const [isOpen, { set }] = useDisclosure(
    item.items.some((subItem) => pathname.includes(subItem.href))
  );

  return (
    <Collapsible
      key={`${item.title}:${pathname}`}
      onOpenChange={set}
      open={isOpen}
    >
      <SidebarMenuItem>
        <CollapsibleTrigger
          render={
            <SidebarMenuButton className="group" tooltip={t(item.title)}>
              {!!item.icon && <HugeIcons icon={item.icon} />}
              <span className="truncate">{t(item.title)}</span>
              <HugeIcons
                className="ml-auto transition-transform duration-200 group-data-panel-open:rotate-90"
                icon={ArrowRight01Icon}
              />
            </SidebarMenuButton>
          }
        />
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items.map((subItem) => {
              const title =
                "value" in subItem
                  ? t(subItem.title, { grade: subItem.value })
                  : t(subItem.title);

              return (
                <SidebarMenuSubItem key={title}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={pathname.includes(subItem.href)}
                  >
                    <NavigationLink href={subItem.href} title={title}>
                      <span>{title}</span>
                    </NavigationLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function NavSubject() {
  const t = useTranslations("Common");

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t("subject")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {subjectMenu.map((item) => (
            <SubjectMenuItem item={item} key={item.title} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
