import { Nina } from "@repo/design-system/components/ui/nina";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useMatchRoute } from "@tanstack/react-router";
import { useTranslations } from "use-intl";
import {
  HeaderCta,
  LogoCta,
  SchoolCta,
} from "@/components/marketing/shared/header/cta";
import { Language } from "@/components/marketing/shared/language";
import { Link, useCurrentLocale } from "@/lib/routing/link";
import { EXACT_ACTIVE_OPTIONS } from "@/lib/routing/tree";

/**
 * Whether the page belongs to Nakafa School, the product for a whole school, and
 * not to the learner's Nakafa. Its pages are the School landing and its pricing.
 */
function useSchoolPage() {
  const locale = useCurrentLocale();
  const matchRoute = useMatchRoute();
  return (
    matchRoute({ fuzzy: true, params: { locale }, to: "/$locale/school" }) !==
    false
  );
}

/**
 * The marketing header in three parts, as the identity's Header card draws it:
 * the name with its links on the left, Nina in the middle, the language and
 * one action on the right. The site sells two products, so the links name both,
 * the learner's Nakafa and Nakafa School, and then the pricing of the product the
 * reader is on. The action follows the product too: a learner tries Nakafa, and a
 * school starts its free trial. The two outer columns share the rest of the
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
  const school = useSchoolPage();

  return (
    <header className="bg-background sticky top-0 z-20 h-16 shrink-0 border-b">
      <div className="mx-auto grid h-full w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-6">
        <div className="flex min-w-0 items-center gap-11">
          <LogoCta />

          <nav className="hidden items-center gap-0.5 lg:flex">
            <Link
              activeOptions={EXACT_ACTIVE_OPTIONS}
              className={buttonVariants({ variant: "ghost" })}
              to="/$locale"
            >
              {t("learn")}
            </Link>
            <Link
              activeOptions={EXACT_ACTIVE_OPTIONS}
              className={buttonVariants({ variant: "ghost" })}
              to="/$locale/school"
            >
              {t("school")}
            </Link>
            <Link
              activeOptions={EXACT_ACTIVE_OPTIONS}
              className={buttonVariants({ variant: "ghost" })}
              to={school ? "/$locale/school/pricing" : "/$locale/pricing"}
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
          {school ? <SchoolCta /> : <HeaderCta />}
        </div>
      </div>
    </header>
  );
}
