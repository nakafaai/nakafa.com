import {
  type Permission,
  ROLE_PERMISSIONS,
} from "@repo/backend/confect/schools/permission/spec";
import { Array as Arr } from "effect";
import { useClass } from "@/lib/school/classes/context";
export function useClassPermissions() {
  const classMembership = useClass((s) => s.classMembership);
  const schoolMembership = useClass((s) => s.schoolMembership);
  const schoolRole = schoolMembership?.role;
  const classRole = classMembership?.role;
  const teacherRole = classMembership?.teacherRole;
  const can = (permission: Permission) => {
    const schoolPerms =
      schoolRole === undefined ? [] : ROLE_PERMISSIONS[schoolRole];
    if (Arr.contains(schoolPerms, permission)) {
      return true;
    }
    if (classRole !== undefined) {
      const classPerms = ROLE_PERMISSIONS[classRole];
      if (Arr.contains(classPerms, permission)) {
        return true;
      }
      if (classRole === "teacher" && teacherRole !== undefined) {
        const teacherPerms = ROLE_PERMISSIONS[teacherRole];
        if (Arr.contains(teacherPerms, permission)) {
          return true;
        }
      }
    }
    return false;
  };
  return {
    can,
  };
}
