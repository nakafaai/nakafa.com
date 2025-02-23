import { ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import NavigationLink from "../ui/navigation-link";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "../ui/sidebar";
import { studyMenu } from "./data/study";

function MenuItem() {
  const t = useTranslations("Material");

  return studyMenu.map((item) => (
    <Collapsible key={item.title} asChild className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={t(item.title)}>
            {item.icon && <item.icon />}
            <span>{t(item.title)}</span>
            <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items.map((subItem) => {
              const grade = t(subItem.title, { grade: subItem.value });

              return (
                <SidebarMenuSubItem key={grade}>
                  <SidebarMenuSubButton asChild>
                    <NavigationLink href={subItem.href}>
                      <span>{grade}</span>
                    </NavigationLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  ));
}

export function NavStudy() {
  const t = useTranslations("Common");

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t("study")}</SidebarGroupLabel>
      <SidebarMenu>
        <MenuItem />
      </SidebarMenu>
    </SidebarGroup>
  );
}
