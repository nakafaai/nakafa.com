"use client";

import NavigationLink from "@repo/design-system/components/navigation/link";
import { Button } from "@repo/design-system/components/ui/button";
import { Link } from "@repo/internationalization/src/navigation";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useUser } from "@/lib/context/use-user";

export function LogoCta() {
  const currentUser = useUser((state) => state.user);

  return (
    <Link
      className="flex items-center gap-2"
      href={currentUser ? "/home" : "/"}
    >
      <Image
        alt="Nakafa"
        className="size-8 rounded-full border"
        height={32}
        src="/logo.svg"
        width={32}
      />
      <span className="font-medium">Nakafa</span>
    </Link>
  );
}

export function HeaderCta() {
  const t = useTranslations("Marketing");

  const currentUser = useUser((state) => state.user);

  if (currentUser) {
    return (
      <Button
        render={<NavigationLink href="/home">{t("try-nakafa")}</NavigationLink>}
      />
    );
  }

  return (
    <div className="flex gap-2">
      <Button
        render={<NavigationLink href="/auth">{t("sign-in")}</NavigationLink>}
      />
      <Button
        render={<NavigationLink href="/auth">{t("sign-up")}</NavigationLink>}
        variant="outline"
      />
    </div>
  );
}
