import { Diamond02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSeparator,
} from "@repo/design-system/components/ui/sidebar-menu";
import {
  EXACT_ACTIVE_OPTIONS,
  Link,
  useCurrentLocale,
} from "@repo/internationalization/src/link";
import { useTranslations } from "use-intl";
import type { CurrentUser } from "@/lib/identity/client";

/** Links a sidebar footer to the localized pricing page. */
export function PricingItem() {
  const locale = useCurrentLocale();
  const t = useTranslations("Auth");
  const label = t("pricing-cta");

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={
          <Link
            activeOptions={EXACT_ACTIVE_OPTIONS}
            params={{ locale }}
            title={label}
            to="/$locale/pricing"
          />
        }
      >
        <HugeIcons icon={Diamond02Icon} />
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/** Keeps pricing and account controls as distinct footer sections for Free users. */
export function AccountPricing({
  plan,
}: {
  plan: CurrentUser["appUser"]["plan"];
}) {
  if (plan === "pro") {
    return null;
  }

  return (
    <>
      <PricingItem />
      <SidebarMenuSeparator />
    </>
  );
}
