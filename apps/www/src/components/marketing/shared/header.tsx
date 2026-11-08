import { Nina } from "@repo/design-system/components/ui/nina";
import { useMatchRoute } from "@tanstack/react-router";
import {
  HeaderCta,
  LogoCta,
  SchoolCta,
} from "@/components/marketing/shared/header/cta";
import { HeaderMenu } from "@/components/marketing/shared/header/menu";
import { HeaderSheet } from "@/components/marketing/shared/header/sheet";
import { Language } from "@/components/marketing/shared/language";
import { useCurrentLocale } from "@/lib/routing/link";

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

/** The header's call to action, which follows the product: a learner tries Nakafa, and a school starts its free trial. */
function HeaderAction() {
  return useSchoolPage() ? <SchoolCta /> : <HeaderCta />;
}

/**
 * The one marketing header of the learner's Nakafa and of Nakafa School, in three
 * parts as the identity's Header card draws it: the name with the two products'
 * sections on the left, Nina in the middle, the language and one action on the
 * right. The two outer columns share the rest of the width equally, so Nina
 * stands in the middle of the page, and she stands on the header's line, which
 * cuts her body. From `lg` each product is a section whose links open on hover
 * or press; below it the Menu button opens the same sections in a sheet, which
 * holds the action on a phone, where only the name, Nina and the button fit.
 * The language leaves below `lg` too: the footer holds it.
 */
export function Header() {
  return (
    <header className="bg-background sticky top-0 z-20 h-16 shrink-0 border-b">
      <div className="mx-auto grid h-full w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-6">
        <div className="flex min-w-0 items-center gap-11">
          <LogoCta />
          <HeaderMenu />
        </div>

        <div
          aria-hidden="true"
          className="flex self-end"
          data-slot="header-nina"
        >
          <Nina act="greeting" label="" lean="peek" size={60} />
        </div>

        <div className="flex items-center justify-end gap-2">
          <span className="max-lg:hidden">
            <Language compact />
          </span>
          <span className="contents max-sm:hidden">
            <HeaderAction />
          </span>
          <HeaderSheet>
            <HeaderAction />
          </HeaderSheet>
        </div>
      </div>
    </header>
  );
}
