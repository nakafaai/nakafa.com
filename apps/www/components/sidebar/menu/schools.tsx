"use client";

import { QueryResult, useQuery } from "@confect/react";
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

/**
 * The schools the account is an active member of, one link each under a heading.
 * This component mounts only while the account menu is open, so the list is read
 * then, and the group is left out when the account holds no school.
 */
export function SidebarSchoolMenuItems() {
  const t = useTranslations("Common");
  const schools = useQuery(tenancy.viewer.schools, {});

  if (
    !(
      QueryResult.isSuccess(schools) &&
      Arr.isReadonlyArrayNonEmpty(schools.value)
    )
  ) {
    return null;
  }

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel>{t("your-schools")}</DropdownMenuLabel>
        {Arr.map(schools.value, (school) => (
          <SidebarSchoolMenuItem
            key={school.slug}
            logo={school.mark.logo}
            mascot={school.mark.mascot}
            name={school.name}
            slug={school.slug}
          />
        ))}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
    </>
  );
}
