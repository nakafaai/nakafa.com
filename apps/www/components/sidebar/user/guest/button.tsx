"use client";

import { Login03Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { usePathname } from "@repo/internationalization/src/navigation";
import { useTranslations } from "next-intl";

/** Renders the primary guest login action for a sidebar footer. */
export function NavUserGuestButton() {
  const t = useTranslations("Auth");
  const pathname = usePathname();
  const authHref = `/auth?redirect=${pathname}`;

  return (
    <Button
      className="w-full"
      nativeButton={false}
      render={<NavigationLink href={authHref} />}
    >
      <HugeIcons icon={Login03Icon} />
      {t("login-cta-action")}
    </Button>
  );
}
