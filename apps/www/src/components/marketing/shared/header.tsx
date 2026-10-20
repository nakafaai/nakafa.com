import { Button } from "@repo/design-system/components/ui/button";
import { Nina } from "@repo/design-system/components/ui/nina";
import {
  EXACT_ACTIVE_OPTIONS,
  Link,
  useCurrentLocale,
} from "@repo/internationalization/src/link";
import { useTranslations } from "use-intl";
import { HeaderCta, LogoCta } from "@/components/marketing/shared/header/cta";
import { HeaderFeaturesLink } from "@/components/marketing/shared/header/features";
import { Language } from "@/components/marketing/shared/language";

/**
 * The marketing header in three parts, as the identity's Header card draws it:
 * the name with its links on the left, Nina in the middle, the language and
 * the sign-up action on the right. The two outer columns share the rest of the
 * width equally, so Nina stands in the middle of the page, not of the gap
 * between the groups. The line under the header is always drawn, and Nina
 * stands on it, so it is the line that cuts her body. The links are ghost
 * buttons side by side, so their own padding is the space between them; the
 * name stands apart from them. The links join from `lg`, where the German
 * labels fit beside the name, and the language button leaves below 440 px,
 * where the action needs the room; both are in the footer too.
 */
export function Header() {
  const t = useTranslations("Marketing");
  const locale = useCurrentLocale();

  return (
    <header className="sticky top-0 z-10 h-16 shrink-0 border-b bg-background">
      <div className="mx-auto grid h-full w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-6">
        <div className="flex min-w-0 items-center gap-11">
          <LogoCta />

          <nav className="hidden items-center gap-0.5 lg:flex">
            <Button
              nativeButton={false}
              render={
                <Link params={{ locale }} to="/$locale">
                  {t("about")}
                </Link>
              }
              variant="ghost"
            />
            <Button
              nativeButton={false}
              render={<HeaderFeaturesLink>{t("features")}</HeaderFeaturesLink>}
              variant="ghost"
            />
            <Button
              nativeButton={false}
              render={
                <Link
                  activeOptions={EXACT_ACTIVE_OPTIONS}
                  params={{ locale }}
                  to="/$locale/pricing"
                >
                  {t("pricing")}
                </Link>
              }
              variant="ghost"
            />
          </nav>
        </div>

        <div
          aria-hidden="true"
          className="flex self-end"
          data-slot="header-nina"
        >
          <Nina act="greeting" label="" lean="peek" size={60} />
        </div>

        <div className="flex items-center justify-end gap-2">
          <span className="max-[440px]:hidden">
            <Language compact />
          </span>
          <HeaderCta />
        </div>
      </div>
    </header>
  );
}
