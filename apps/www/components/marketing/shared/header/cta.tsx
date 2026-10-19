"use client";

import { Button } from "@repo/design-system/components/ui/button";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { Link } from "@repo/internationalization/src/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useViewer } from "@/lib/identity/client";

/**
 * The name of the header, written as text: the identity's Header card keeps the
 * letter logo out of the header. It routes a signed-in learner home and clears
 * stale marketing fragments for a signed-out visitor.
 */
export function LogoCta() {
  const currentUser = useViewer((state) => state.account);
  const locale = useLocale();

  if (!currentUser) {
    return (
      <a className="font-medium" href={`/${locale}`}>
        Nakafa
      </a>
    );
  }

  return (
    <Link className="font-medium" href="/home">
      Nakafa
    </Link>
  );
}

export function HeaderCta() {
  const t = useTranslations("Marketing");
  const currentUser = useViewer((state) => state.account);
  const href = currentUser ? "/home" : "/auth";

  return (
    <Button
      nativeButton={false}
      render={<NavigationLink href={href}>{t("try-nakafa")}</NavigationLink>}
      variant="secondary"
    />
  );
}
