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

/** How many schools the account menu lists: the first page of the account's memberships. */
const SCHOOL_PAGE = 20;

/**
 * The schools the account is an active member of, in the order the memberships
 * query answers them. The account button reads them as it mounts, so the menu
 * has them ready when it opens and nothing in it moves.
 */
export function useAccountSchools() {
  const memberships = usePaginatedQuery(
    tenancy.memberships.list,
    {},
    { initialNumItems: SCHOOL_PAGE }
  );
  return PaginatedQueryResult.isLoadingFirstPage(memberships) ||
    PaginatedQueryResult.isFailure(memberships)
    ? []
    : Arr.map(memberships.results, (membership) => membership.tenant);
}

/**
 * The account's schools in its menu, one link each under a heading, and nothing
 * when the account holds no school.
 */
export function SidebarSchoolMenuItems({
  schools,
}: {
  schools: ReturnType<typeof useAccountSchools>;
}) {
  const t = useTranslations("Common");

  if (!Arr.isReadonlyArrayNonEmpty(schools)) {
    return null;
  }

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel>{t("your-schools")}</DropdownMenuLabel>
        {Arr.map(schools, (school) => (
          <SidebarSchoolMenuItem
            key={school.slug}
            logo={school.logo}
            mascot={school.mascot}
            name={school.name}
            slug={school.slug}
          />
        ))}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
    </>
  );
}
