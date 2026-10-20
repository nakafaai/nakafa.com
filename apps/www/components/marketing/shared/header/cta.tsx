"use client";

import { Button } from "@repo/design-system/components/ui/button";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { Link } from "@repo/internationalization/src/navigation";
import { useLocale, useTranslations } from "use-intl";

/**
 * The name of the header, written as text: the identity's Header card keeps the
 * letter logo out of the header. A visitor's name opens the locale's home, and a
 * learner's opens their home. Both are rendered, and the signed-in hint of the
 * root picks the one that shows, so the first paint needs no account state.
 */
export function LogoCta() {
  const locale = useLocale();

  return (
    <>
      <span className="contents" data-account="visitor">
        <a className="font-medium" href={`/${locale}`}>
          Nakafa
        </a>
      </span>
      <span className="contents" data-account="member">
        <Link className="font-medium" href="/home">
          Nakafa
        </Link>
      </span>
    </>
  );
}

/**
 * The header's call to action: a visitor signs up, and a learner opens home. The
 * signed-in hint of the root picks the one that shows, as `LogoCta` does.
 */
export function HeaderCta() {
  const t = useTranslations("Marketing");

  return (
    <>
      <span className="contents" data-account="visitor">
        <Button
          nativeButton={false}
          render={
            <NavigationLink href="/auth">{t("try-nakafa")}</NavigationLink>
          }
          variant="secondary"
        />
      </span>
      <span className="contents" data-account="member">
        <Button
          nativeButton={false}
          render={
            <NavigationLink href="/home">{t("try-nakafa")}</NavigationLink>
          }
          variant="secondary"
        />
      </span>
    </>
  );
}
