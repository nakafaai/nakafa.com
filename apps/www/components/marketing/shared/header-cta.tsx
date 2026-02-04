"use client";

import { Button } from "@repo/design-system/components/ui/button";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { useTranslations } from "next-intl";
import { useUser } from "@/lib/context/use-user";

export function HeaderCta() {
  const t = useTranslations("Marketing");

  const currentUser = useUser((state) => state.user);

  if (currentUser) {
    return (
      <Button
        nativeButton={false}
        render={<NavigationLink href="/">{t("try-nakafa")}</NavigationLink>}
      />
    );
  }

  return (
    <div className="flex gap-2">
      <Button
        nativeButton={false}
        render={<NavigationLink href="/auth">{t("sign-in")}</NavigationLink>}
      />
      <Button
        nativeButton={false}
        render={<NavigationLink href="/auth">{t("sign-up")}</NavigationLink>}
        variant="outline"
      />
    </div>
  );
}
