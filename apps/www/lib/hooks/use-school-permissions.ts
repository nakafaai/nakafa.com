import {
  type Permission,
  ROLE_PERMISSIONS,
} from "@repo/backend/convex/lib/permissions";
import { useSchool } from "@/lib/context/use-school";

export function useSchoolPermissions() {
  const schoolMembership = useSchool((s) => s.schoolMembership);
  const schoolRole = schoolMembership?.role;

  const can = (permission: Permission) => {
    const perms = schoolRole ? (ROLE_PERMISSIONS[schoolRole] ?? []) : [];
    return perms.includes(permission);
  };

  return { can };
}
