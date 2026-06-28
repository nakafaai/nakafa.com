"use client";

import { Login01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { SidebarMenuButton } from "@repo/design-system/components/ui/sidebar";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useTranslations } from "next-intl";
import type * as React from "react";

/**
 * Renders the signed-out sidebar footer login action with the same footprint as
 * the signed-in profile trigger so auth hydration never changes footer height.
 */
export function NavUserGuestButton({
  onClick,
  ...props
}: React.ComponentProps<typeof SidebarMenuButton>) {
  const t = useTranslations("Auth");
  const pathname = usePathname();
  const router = useRouter();
  const authHref = `/auth?redirect=${pathname}`;

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    onClick?.(event);

    if (event.defaultPrevented) {
      return;
    }

    router.push(authHref);
  }

  return (
    <SidebarMenuButton onClick={handleClick} size="lg" {...props}>
      <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <HugeIcons className="size-4" icon={Login01Icon} />
      </div>
      <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{t("login-cta-title")}</span>
        <span className="truncate text-muted-foreground text-xs">
          {t("login-cta-action")}
        </span>
      </div>
    </SidebarMenuButton>
  );
}
