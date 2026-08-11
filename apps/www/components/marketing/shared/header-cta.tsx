"use client";

import { Button } from "@repo/design-system/components/ui/button";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { Link } from "@repo/internationalization/src/navigation";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useUser } from "@/lib/context/use-user";

/** Renders the shared Nakafa mark used by both logo destinations. */
function LogoContent() {
  return (
    <>
      <Image
        alt="Nakafa"
        className="size-8 rounded-full border"
        height={32}
        src="/logo.svg"
        width={32}
      />
      <span className="font-medium">Nakafa</span>
    </>
  );
}

/**
 * Routes authenticated users home and clears stale marketing fragments for
 * signed-out visitors.
 */
export function LogoCta() {
  const currentUser = useUser((state) => state.user);
  const locale = useLocale();

  if (!currentUser) {
    return (
      <a className="flex items-center gap-2" href={`/${locale}`}>
        <LogoContent />
      </a>
    );
  }

  return (
    <Link className="flex items-center gap-2" href="/home">
      <LogoContent />
    </Link>
  );
}

export function HeaderCta() {
  const t = useTranslations("Marketing");
  const currentUser = useUser((state) => state.user);
  const href = currentUser ? "/home" : "/auth";

  return (
    <Button
      nativeButton={false}
      render={<NavigationLink href={href}>{t("try-nakafa")}</NavigationLink>}
    />
  );
}
