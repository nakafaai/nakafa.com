"use client";

import { Diamond02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { useTranslations } from "next-intl";
import { AnalyticsConsentSidebarItem } from "@/components/analytics/consent/actions";
import { GuestLanguageMenu } from "@/components/sidebar/preference-menu";
import { NavUserGuestButton } from "@/components/sidebar/user/guest/button";

/** Renders guest utilities and the signed-out account call to action. */
export function NavUserGuest() {
  const t = useTranslations("Auth");

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          render={
            <NavigationLink
              href={{ pathname: "/", hash: "pricing" }}
              title={t("pricing-cta")}
            />
          }
        >
          <HugeIcons icon={Diamond02Icon} />
          <span>{t("pricing-cta")}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <GuestLanguageMenu />
      <AnalyticsConsentSidebarItem />
      <SidebarMenuItem
        className="-mx-2 my-1 border-sidebar-border border-t"
        role="separator"
      />
      <SidebarMenuItem className="flex flex-col gap-3 px-2 py-1">
        <div className="grid gap-1">
          <p className="font-medium text-sm">{t("login-cta-title")}</p>
          <p className="text-muted-foreground text-sm leading-snug">
            {t("login-cta-description")}
          </p>
        </div>
        <NavUserGuestButton />
      </SidebarMenuItem>
    </>
  );
}
