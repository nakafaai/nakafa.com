import {
  ChildIcon,
  ManagerIcon,
  StudentIcon,
  TeacherIcon,
} from "@hugeicons/core-free-icons";

export const roles = [
  { value: "teacher", icon: TeacherIcon },
  { value: "student", icon: StudentIcon },
  { value: "parent", icon: ChildIcon },
  { value: "administrator", icon: ManagerIcon },
] as const;
