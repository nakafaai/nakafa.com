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
import { useLocale, useTranslations } from "use-intl";
import { SchoolMark } from "@/components/tenant/mark";
import { schoolOrigin } from "@/lib/routing/school/host";

/** One school of the account menu: its mark and its name, as a link to the school's own address. */
function SidebarSchoolMenuItem({
  tenant,
}: {
  tenant: {
    logo: string | undefined;
    mascot: typeof Mascot.Type;
    name: string;
    slug: TenantSlug;
  };
}) {
  return (
    <DropdownMenuItem
      className="cursor-pointer"
      render={(props) => (
        <a {...props} href={schoolOrigin(tenant.slug).href}>
          <SchoolMark logo={tenant.logo} mascot={tenant.mascot} />
          <span className="truncate">{tenant.name}</span>
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
 * The account's group of schools in its menu, under the heading "Your schools": one
 * link for each school, then the item that opens a new one when the account may
 * open a school (a school login account may not). The group is shown only when the
 * account has a school or may open one, so an account with neither sees no empty
 * heading. The menu loads this part, and with it the school contracts, once the
 * menu warms, so no page carries them in its first JavaScript. A failed read shows
 * one disabled line, so the group is never silently empty. The next page loads as
 * the end of the list comes into view.
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
  const isFailed = PaginatedQueryResult.isFailure(memberships);

  if (!(isFailed || canOpenSchool) && memberships.results.length === 0) {
    return null;
  }

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel>{t("your-schools")}</DropdownMenuLabel>
        {isFailed ? (
          <DropdownMenuItem disabled>{t("load-error")}</DropdownMenuItem>
        ) : (
          Arr.map(memberships.results, ({ tenant }) => (
            <SidebarSchoolMenuItem key={tenant.slug} tenant={tenant} />
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
