"use client";

import { Login03Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { useTranslations } from "next-intl";
import { useCurrentAuthNavigation } from "@/lib/auth/location.client";

/** Renders the primary guest login action for a sidebar footer. */
export function NavUserGuestButton() {
  const t = useTranslations("Auth");
  const authNavigation = useCurrentAuthNavigation();

  return (
    <Button
      className="w-full"
      nativeButton={false}
      render={<NavigationLink {...authNavigation.linkProps} />}
    >
      <HugeIcons icon={Login03Icon} />
      {t("login-cta-action")}
    </Button>
  );
}
