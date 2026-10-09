import {
  ChildIcon,
  StudentIcon,
  TeacherIcon,
} from "@hugeicons/core-free-icons";
import {
  type SelfSelectableUserRole,
  selfSelectableUserRoles,
} from "@repo/backend/confect/users/roles";
import { Array as Arr } from "effect";

export const roleIconByValue: Record<
  SelfSelectableUserRole,
  typeof TeacherIcon
> = {
  parent: ChildIcon,
  student: StudentIcon,
  teacher: TeacherIcon,
};

/** Self-selectable user roles with UI-local icon metadata. */
export const roles = Arr.map(selfSelectableUserRoles, (value) => ({
  icon: roleIconByValue[value],
  value,
}));
