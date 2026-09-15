"use client";

import { Login03Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useTranslations } from "next-intl";
import { useCurrentAuthNavigation } from "@/lib/auth/location.client";

/** Renders the primary guest login action for a sidebar footer. */
export function NavUserGuestButton() {
  const t = useTranslations("Auth");
  const authNavigation = useCurrentAuthNavigation();

  return (
    <NavigationLink
      {...authNavigation.linkProps}
      className={buttonVariants({ className: "w-full" })}
    >
      <HugeIcons icon={Login03Icon} />
      {t("login-cta-action")}
    </NavigationLink>
  );
}
