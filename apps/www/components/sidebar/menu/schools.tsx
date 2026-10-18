"use client";

import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@repo/design-system/components/ui/dropdown-menu";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import type { Mascot } from "@repo/mascot/code";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
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
 * The account's schools in its menu, one link each under a heading. The menu loads
 * this part, and with it the school contracts, when it opens, so no page carries
 * them in its first JavaScript. Nothing shows while the first page loads, and a
 * failed read shows one disabled line, so the menu is never silently empty. The
 * next page loads as the end of the list comes into view, and nothing shows for an
 * account with no school.
 */
export function SidebarSchoolMenuItems() {
  const t = useTranslations("Common");
  const memberships = usePaginatedQuery(
    tenancy.memberships.list,
    {},
    { initialNumItems: SCHOOL_PAGE }
  );

  if (PaginatedQueryResult.isLoadingFirstPage(memberships)) {
    return null;
  }
  if (PaginatedQueryResult.isFailure(memberships)) {
    return (
      <>
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("your-schools")}</DropdownMenuLabel>
          <DropdownMenuItem disabled>{t("load-error")}</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
      </>
    );
  }
  if (!Arr.isReadonlyArrayNonEmpty(memberships.results)) {
    return null;
  }

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel>{t("your-schools")}</DropdownMenuLabel>
        {Arr.map(memberships.results, ({ tenant }) => (
          <SidebarSchoolMenuItem
            key={tenant.slug}
            logo={tenant.logo}
            mascot={tenant.mascot}
            name={tenant.name}
            slug={tenant.slug}
          />
        ))}
        {PaginatedQueryResult.isCanLoadMore(memberships) ? (
          <Intersection onIntersect={() => memberships.loadMore(SCHOOL_PAGE)} />
        ) : null}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
    </>
  );
}
