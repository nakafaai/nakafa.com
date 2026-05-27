import {
  type Permission,
  roleHasPermission,
} from "@repo/backend/confect/modules/school/permissions";
import { useSchool } from "@/lib/context/use-school";

export function useSchoolPermissions() {
  const schoolMembership = useSchool((s) => s.schoolMembership);
  const schoolRole = schoolMembership?.role;

  const can = (permission: Permission) =>
    roleHasPermission(schoolRole, permission);

  return { can };
}
