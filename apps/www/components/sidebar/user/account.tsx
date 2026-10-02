"use client";

import {
  FileValidationIcon,
  LockIcon,
  Settings01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useTranslations } from "next-intl";
import { AnalyticsConsentMenuItem } from "@/components/analytics/consent/actions";
import { AccountMenu } from "@/components/sidebar/menu/account";
import { SidebarUtilityMenuItems } from "@/components/sidebar/menu/utility";
import { usePageNavigation } from "@/lib/content/page/context";
import type { CurrentUser } from "@/lib/identity/client";

/** Renders the app account menu, with the account and legal pages, once authentication is confirmed. */
export function NavUserAccount({ user }: { user: CurrentUser }) {
  const t = useTranslations("Auth");
  const tLegal = useTranslations("Legal");
  const pageNavigation = usePageNavigation((navigation) => navigation);
  const router = useRouter();

  return (
    <AccountMenu user={user}>
      <DropdownMenuGroup>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => router.push(`/user/${user.appUser._id}`)}
        >
          <HugeIcons icon={UserIcon} />
          {t("profile")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => router.push("/user/settings")}
        >
          <HugeIcons icon={Settings01Icon} />
          {t("settings")}
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <SidebarUtilityMenuItems />
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        {pageNavigation ? (
          <>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => router.push(pageNavigation.termsOfServiceHref)}
            >
              <HugeIcons icon={FileValidationIcon} />
              {tLegal("terms-of-service")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => router.push(pageNavigation.privacyPolicyHref)}
            >
              <HugeIcons icon={LockIcon} />
              {tLegal("privacy-policy")}
            </DropdownMenuItem>
          </>
        ) : null}
        <AnalyticsConsentMenuItem />
      </DropdownMenuGroup>
    </AccountMenu>
  );
}
