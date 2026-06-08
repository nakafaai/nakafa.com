import {
  ChildIcon,
  StudentIcon,
  TeacherIcon,
} from "@hugeicons/core-free-icons";
import {
  type SelfSelectableUserRole,
  selfSelectableUserRoles,
} from "@repo/backend/convex/users/roles";

const roleIcons: Record<SelfSelectableUserRole, typeof TeacherIcon> = {
  parent: ChildIcon,
  student: StudentIcon,
  teacher: TeacherIcon,
};

/** Self-selectable user roles with UI-local icon metadata. */
export const roles = selfSelectableUserRoles.map((value) => ({
  icon: roleIcons[value],
  value,
}));
