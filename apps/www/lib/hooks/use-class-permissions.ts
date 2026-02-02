import {
  type Permission,
  ROLE_PERMISSIONS,
} from "@repo/backend/convex/lib/helpers/permissions";
import { useClass } from "@/lib/context/use-class";

export function useClassPermissions() {
  const classMembership = useClass((s) => s.classMembership);
  const schoolMembership = useClass((s) => s.schoolMembership);
  const schoolRole = schoolMembership?.role;
  const classRole = classMembership?.role;
  const teacherRole = classMembership?.teacherRole;

  const can = (permission: Permission) => {
    const schoolPerms = schoolRole ? (ROLE_PERMISSIONS[schoolRole] ?? []) : [];
    if (schoolPerms.includes(permission)) {
      return true;
    }

    if (classRole) {
      const classPerms = ROLE_PERMISSIONS[classRole] ?? [];
      if (classPerms.includes(permission)) {
        return true;
      }

      if (classRole === "teacher" && teacherRole) {
        const teacherPerms = ROLE_PERMISSIONS[teacherRole] ?? [];
        if (teacherPerms.includes(permission)) {
          return true;
        }
      }
    }

    return false;
  };

  return { can };
}
