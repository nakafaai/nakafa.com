"use client";

import { Diamond02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { useTranslations } from "next-intl";
import type { CurrentUser } from "@/lib/context/use-user";

/** Links a sidebar footer to the localized pricing page. */
export function PricingItem() {
  const t = useTranslations("Auth");
  const label = t("pricing-cta");

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<NavigationLink href="/pricing" title={label} />}
      >
        <HugeIcons icon={Diamond02Icon} />
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/** Keeps the upgrade path visible for authenticated accounts without Pro. */
export function AccountPricing({
  plan,
}: {
  plan: CurrentUser["appUser"]["plan"];
}) {
  if (plan === "pro") {
    return null;
  }

  return <PricingItem />;
}
