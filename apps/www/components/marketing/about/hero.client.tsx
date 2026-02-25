"use client";

import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { useTranslations } from "next-intl";
import { useUser } from "@/lib/context/use-user";

export function HeroCta() {
  const t = useTranslations("About");
  const user = useUser((state) => state.user);

  return (
    <Button
      nativeButton={false}
      render={
        <NavigationLink href={user ? "/" : "/auth"}>
          <HugeIcons icon={ArrowUpRight01Icon} />
          {t("start-learning")}
        </NavigationLink>
      }
    />
  );
}
