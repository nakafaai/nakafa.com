"use client";

import {
  DiscordIcon,
  FavouriteIcon,
  LinkSquare02Icon,
} from "@hugeicons/core-free-icons";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useRouter } from "@repo/internationalization/src/navigation";
import { COMPANY_SOCIAL_PROFILES } from "@repo/seo/company-profiles";
import { useTranslations } from "use-intl";
import { SidebarPreferenceSubmenus } from "@/components/sidebar/menu/preference";

/** Renders the shared utilities inside the account menu. */
export function SidebarUtilityMenuItems() {
  const router = useRouter();
  const t = useTranslations("Common");

  return (
    <>
      <SidebarPreferenceSubmenus />
      <DropdownMenuGroup>
        <DropdownMenuItem
          className="cursor-pointer"
          render={(props) => (
            <a
              {...props}
              href={COMPANY_SOCIAL_PROFILES.discord}
              rel="noopener noreferrer"
              target="_blank"
            >
              <HugeIcons icon={DiscordIcon} />
              {t("community")}
              <HugeIcons className="ml-auto size-4" icon={LinkSquare02Icon} />
            </a>
          )}
        />
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => router.push("/")}
        >
          <HugeIcons icon={FavouriteIcon} />
          {t("about")}
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </>
  );
}
