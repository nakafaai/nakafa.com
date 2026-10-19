"use client";

import { QueryResult, useQuery } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { usePathname } from "@repo/internationalization/src/navigation";
import { Array as Arr, String as Str } from "effect";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useConvexAuth } from "@/components/providers/convex";
import type { TenantValue } from "@/components/tenant/context";
import { useTenant } from "@/components/tenant/context";
import { TenantSidebarGroup } from "@/components/tenant/group";

/**
 * Reads the viewer's classes in the school's active periods once Convex has settled
 * the session, so the query never runs before the viewer is known.
 */
function useClassesQuery(slug: TenantValue["slug"]) {
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  return useQuery(classroom.classes.mine, isSettled ? { slug } : "skip");
}

/**
 * The Classes group of the school sidebar: one entry per class the viewer teaches or
 * attends in the school's active periods, in the order the server gives. The group
 * draws nothing while the classes load, and nothing for a viewer with no class, so
 * the entries above it never move.
 */
export function TenantClassesGroup() {
  const { slug } = useTenant();
  const classes = useClassesQuery(slug);
  const t = useTranslations("School");
  const rows = QueryResult.isSuccess(classes) ? classes.value : [];

  if (!Arr.isReadonlyArrayNonEmpty(rows)) {
    return null;
  }

  return (
    <TenantSidebarGroup label={t("classes")}>
      {Arr.map(rows, (klass) => (
        <TenantClassItem key={klass.id} name={klass.name} slug={klass.slug} />
      ))}
    </TenantSidebarGroup>
  );
}

/**
 * One class of the school sidebar, linking to the class page on the school host. Its
 * entry is the current page on the class page and on its tabs.
 */
function TenantClassItem({ name, slug }: { name: string; slug: string }) {
  const pathname = usePathname();
  const base = `/classes/${slug}`;
  const isActive = pathname === base || Str.startsWith(`${base}/`)(pathname);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isActive} render={<Link href={base} />}>
        {name}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
