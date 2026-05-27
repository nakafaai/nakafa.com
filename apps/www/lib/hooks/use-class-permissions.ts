import {
  type Permission,
  roleHasPermission,
} from "@repo/backend/confect/modules/school/permissions";
import { useClass } from "@/lib/context/use-class";

export function useClassPermissions() {
  const classMembership = useClass((s) => s.classMembership);
  const schoolMembership = useClass((s) => s.schoolMembership);
  const schoolRole = schoolMembership?.role;
  const classRole = classMembership?.role;
  const teacherRole = classMembership?.teacherRole;

  const can = (permission: Permission) => {
    if (roleHasPermission(schoolRole, permission)) {
      return true;
    }

    if (classRole !== undefined) {
      if (roleHasPermission(classRole, permission)) {
        return true;
      }

      if (
        classRole === "teacher" &&
        teacherRole !== undefined &&
        roleHasPermission(teacherRole, permission)
      ) {
        return true;
      }
    }

    return false;
  };

  return { can };
}
