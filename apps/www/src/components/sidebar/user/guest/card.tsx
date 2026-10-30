import {
  SidebarMenuItem,
  SidebarMenuSeparator,
} from "@repo/design-system/components/ui/sidebar-menu";
import { useTranslations } from "use-intl";
import { VisitorConsentMenuItem } from "@/components/analytics/consent/menu";
import {
  CommunityMenuItem,
  GuestLearnMoreMenu,
  LegalMenuItems,
  NakafaAboutMenuItem,
} from "@/components/sidebar/menu/learn";
import { GuestLanguageMenu } from "@/components/sidebar/menu/preference";
import { PricingItem } from "@/components/sidebar/menu/pricing";
import { NavUserGuestButton } from "@/components/sidebar/user/guest/action";

/** Renders guest utilities and the signed-out account call to action. */
export function NavUserGuest() {
  const t = useTranslations("Auth");

  return (
    <>
      <PricingItem />
      <GuestLanguageMenu />
      <GuestLearnMoreMenu>
        <NakafaAboutMenuItem />
        <CommunityMenuItem />
        <LegalMenuItems />
        <VisitorConsentMenuItem />
      </GuestLearnMoreMenu>
      <SidebarMenuSeparator />
      <SidebarMenuItem className="flex flex-col gap-3 px-2 py-1">
        <div className="grid gap-1 group-data-[collapsible=icon]:hidden">
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
