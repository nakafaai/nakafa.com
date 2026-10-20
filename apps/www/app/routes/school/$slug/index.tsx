import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { TenantHome } from "@/components/tenant/home";
import { showsStudentHome } from "@/components/tenant/home/access";
import type { HomePreload } from "@/components/tenant/home/data";
import { canManageSchool, roleOf } from "@/lib/tenant/frame";
import { readStaffHomeFn, readStudentHomeFn } from "@/lib/tenant/home.fn";

/**
 * The home of a school host, rendered inside the school shell. A member's home
 * reads its first screen here, so the tiles it shows are in the first HTML. A
 * visitor and an account that is not a member see no home, so nothing is read for
 * them.
 */
export const Route = createFileRoute("/school/$slug/")({
  loader: async ({ context }): Promise<HomePreload> => {
    const { school, slug } = context;
    if (school._tag !== "Member") {
      return {};
    }
    const canManage = canManageSchool(school.viewer.can);
    const studentView = showsStudentHome(
      { canManage, role: roleOf(school.viewer.grants) },
      school.home
    );
    if (studentView) {
      return { sittings: await readStudentHomeFn({ data: { slug } }) };
    }
    return readStaffHomeFn({ data: { canManage, slug } });
  },
  component: SchoolHomePage,
});

function SchoolHomePage(): ReactElement {
  const preload = Route.useLoaderData();
  return <TenantHome preload={preload} />;
}
