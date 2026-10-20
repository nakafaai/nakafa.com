"use client";

import { Image } from "@repo/design-system/components/image";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuDescription,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import {
  EXACT_ACTIVE_OPTIONS,
  Link,
  useCurrentLocale,
} from "@repo/internationalization/src/link";
import { useTranslations } from "use-intl";
import { useViewer } from "@/lib/identity/client";

export function HeaderMenu() {
  const locale = useCurrentLocale();
  const t = useTranslations("Metadata");
  const currentUser = useViewer((state) => state.account);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          render={
            <Link
              activeOptions={EXACT_ACTIVE_OPTIONS}
              params={{ locale }}
              title="Nakafa"
              to={currentUser ? "/$locale/home" : "/$locale"}
            />
          }
          size="lg"
        >
          <div className="relative aspect-square size-8">
            <Image
              alt=""
              className="rounded-sm border object-contain"
              fill
              sizes="32px"
              src="/logo.svg"
            />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <p className="truncate font-medium">Nakafa</p>
            <SidebarMenuDescription>
              {t("very-short-description")}
            </SidebarMenuDescription>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
