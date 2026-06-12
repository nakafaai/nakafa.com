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
import { useTranslations } from "next-intl";
import type * as React from "react";

import { SidebarPreferenceSubmenus } from "@/components/sidebar/preference-submenus";

/**
 * Renders the sidebar utilities that belong inside the user dropdown in both
 * signed-in and signed-out states.
 */
export function SidebarUtilityMenuItems({
  side,
}: React.ComponentProps<typeof SidebarPreferenceSubmenus>) {
  const router = useRouter();
  const t = useTranslations("Common");

  return (
    <>
      <SidebarPreferenceSubmenus side={side} />
      <DropdownMenuGroup>
        <DropdownMenuItem
          className="cursor-pointer"
          render={(props) => (
            <a
              {...props}
              href="https://discord.gg/CPCSfKhvfQ"
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
