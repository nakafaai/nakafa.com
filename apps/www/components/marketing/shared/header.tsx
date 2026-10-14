import { Button } from "@repo/design-system/components/ui/button";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { Nina } from "@repo/design-system/components/ui/nina";
import { useLocale, useTranslations } from "next-intl";
import { HeaderContainer } from "@/components/marketing/shared/header/container";
import { HeaderCta, LogoCta } from "@/components/marketing/shared/header/cta";
import { Language } from "@/components/marketing/shared/language";

/**
 * The marketing header in three parts: the name with its links, Nina peeking in
 * the middle, and the language and the sign-up action on the right. The name
 * stands apart from the links, which read as one group.
 */
export function Header() {
  const t = useTranslations("Marketing");
  const locale = useLocale();

  return (
    <HeaderContainer>
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-6">
        <div className="flex items-center">
          <LogoCta />

          <nav className="hidden items-center gap-6.5 ps-14 md:flex">
            <Button
              nativeButton={false}
              render={<a href={`/${locale}`}>{t("about")}</a>}
              variant="ghost"
            />
            <Button
              nativeButton={false}
              render={
                <NavigationLink href={{ pathname: "/", hash: "lesson" }}>
                  {t("features")}
                </NavigationLink>
              }
              variant="ghost"
            />
            <Button
              nativeButton={false}
              render={
                <NavigationLink href="/pricing">{t("pricing")}</NavigationLink>
              }
              variant="ghost"
            />
          </nav>
        </div>

        <div aria-hidden="true" className="hidden md:block">
          <Nina act="greeting" label="" lean="peek" size={40} />
        </div>

        <div className="flex items-center gap-2">
          <Language compact />
          <HeaderCta />
        </div>
      </div>
    </HeaderContainer>
  );
}
