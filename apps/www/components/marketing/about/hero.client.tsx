"use client";

import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import NavigationLink from "@repo/design-system/components/navigation/link";
import { Button } from "@repo/design-system/components/ui/button";
import { useTranslations } from "next-intl";
import { useUser } from "@/lib/context/use-user";

export function HeroCta() {
  const t = useTranslations("About");
  const user = useUser((state) => state.user);

  return (
    <Button
      render={
        <NavigationLink href={user ? "/home" : "/auth"}>
          <HugeIcons icon={ArrowUpRight01Icon} />
          {t("start-learning")}
        </NavigationLink>
      }
    />
  );
}
