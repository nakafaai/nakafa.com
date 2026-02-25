import { Button } from "@repo/design-system/components/ui/button";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { useTranslations } from "next-intl";
import { HeaderContainer } from "@/components/marketing/shared/header-container";
import { HeaderCta, LogoCta } from "@/components/marketing/shared/header-cta";

export function Header() {
  const t = useTranslations("Marketing");

  return (
    <HeaderContainer>
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-6">
        <LogoCta />

        <nav className="hidden items-center gap-1 md:flex">
          <Button
            nativeButton={false}
            render={<NavigationLink href="/about">{t("about")}</NavigationLink>}
            variant="ghost"
          />
          <Button
            nativeButton={false}
            render={
              <NavigationLink href="/about#features">
                {t("features")}
              </NavigationLink>
            }
            variant="ghost"
          />
          <Button
            nativeButton={false}
            render={
              <NavigationLink href="/about#pricing">
                {t("pricing")}
              </NavigationLink>
            }
            variant="ghost"
          />
        </nav>

        <HeaderCta />
      </div>
    </HeaderContainer>
  );
}
