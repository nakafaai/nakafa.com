"use client";

import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import { PlusSignIcon } from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import type { Mascot } from "@repo/mascot/code";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { SchoolMark } from "@/components/tenant/mark";
import { schoolOrigin } from "@/lib/routing/school/host";

/** One school of the account menu: its mark and its name, as a link to the school's own address. */
function SidebarSchoolMenuItem({
  logo,
  mascot,
  name,
  slug,
}: {
  logo: string | undefined;
  mascot: typeof Mascot.Type;
  name: string;
  slug: TenantSlug;
}) {
  return (
    <DropdownMenuItem
      className="cursor-pointer"
      render={(props) => (
        <a {...props} href={schoolOrigin(slug).href}>
          <SchoolMark logo={logo} mascot={mascot} />
          <span className="truncate">{name}</span>
        </a>
      )}
    />
  );
}

/** How many schools the account menu loads at a time: the first page, then each page as the list reaches its end. */
const SCHOOL_PAGE = 20;

/**
 * The item that opens a new school: the questionnaire on the main site, named
 * by its full address, because the menu also shows on a school's own host.
 */
function SidebarStartSchoolMenuItem() {
  const t = useTranslations("Common");
  const locale = useLocale();

  return (
    <DropdownMenuItem
      className="cursor-pointer"
      render={(props) => (
        <a {...props} href={new URL(`/${locale}/school/new`, SITE_ORIGIN).href}>
          <HugeIcons icon={PlusSignIcon} />
          {t("open-school")}
        </a>
      )}
    />
  );
}

/**
 * The account's schools in its menu, one link each under a heading, and the item
 * that opens a new one when the account may open a school: a school login
 * account may not. The menu loads this part, and with it the school
 * contracts, when it opens, so no page carries them in its first JavaScript. The
 * item that opens a school shows at once; the schools follow once their first
 * page loads, and a failed read shows one disabled line, so the list is never
 * silently empty. The next page loads as the end of the list comes into view.
 */
export function SidebarSchoolMenuItems({
  canOpenSchool,
}: {
  canOpenSchool: boolean;
}) {
  const t = useTranslations("Common");
  const memberships = usePaginatedQuery(
    tenancy.memberships.list,
    {},
    { initialNumItems: SCHOOL_PAGE }
  );

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel>{t("your-schools")}</DropdownMenuLabel>
        {PaginatedQueryResult.isFailure(memberships) ? (
          <DropdownMenuItem disabled>{t("load-error")}</DropdownMenuItem>
        ) : (
          Arr.map(memberships.results, ({ tenant }) => (
            <SidebarSchoolMenuItem
              key={tenant.slug}
              logo={tenant.logo}
              mascot={tenant.mascot}
              name={tenant.name}
              slug={tenant.slug}
            />
          ))
        )}
        {PaginatedQueryResult.isCanLoadMore(memberships) ? (
          <Intersection onIntersect={() => memberships.loadMore(SCHOOL_PAGE)} />
        ) : null}
        {canOpenSchool ? <SidebarStartSchoolMenuItem /> : null}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
    </>
  );
}
