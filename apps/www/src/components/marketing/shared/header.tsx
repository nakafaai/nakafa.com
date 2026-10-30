import { Nina } from "@repo/design-system/components/ui/nina";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useMatchRoute } from "@tanstack/react-router";
import { useTranslations } from "use-intl";
import { LESSON_SECTION_ID } from "@/components/marketing/about/lesson/id";
import { HeaderCta, LogoCta } from "@/components/marketing/shared/header/cta";
import { scrollToLessonSection } from "@/components/marketing/shared/header/features";
import { Language } from "@/components/marketing/shared/language";
import { Link, useCurrentLocale } from "@/lib/routing/link";
import { EXACT_ACTIVE_OPTIONS } from "@/lib/routing/tree";

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
  const matchRoute = useMatchRoute();
  const onHome = matchRoute({ params: { locale }, to: "/$locale" }) !== false;

  return (
    <header className="sticky top-0 z-10 h-16 shrink-0 border-b bg-background">
      <div className="mx-auto grid h-full w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-6">
        <div className="flex min-w-0 items-center gap-11">
          <LogoCta />

          <nav className="hidden items-center gap-0.5 lg:flex">
            <Link
              activeOptions={EXACT_ACTIVE_OPTIONS}
              className={buttonVariants({ variant: "ghost" })}
              to="/$locale"
            >
              {t("about")}
            </Link>
            {/* On the home page the lesson section is already on screen, so the link scrolls to it itself; from another page the router scrolls to it. */}
            <Link
              activeOptions={EXACT_ACTIVE_OPTIONS}
              className={buttonVariants({ variant: "ghost" })}
              hash={LESSON_SECTION_ID}
              onClick={() => {
                if (onHome) {
                  scrollToLessonSection();
                }
              }}
              resetScroll={!onHome}
              to="/$locale"
            >
              {t("features")}
            </Link>
            <Link
              activeOptions={EXACT_ACTIVE_OPTIONS}
              className={buttonVariants({ variant: "ghost" })}
              to="/$locale/pricing"
            >
              {t("pricing")}
            </Link>
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
