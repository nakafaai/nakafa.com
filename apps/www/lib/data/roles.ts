import {
  ChildIcon,
  StudentIcon,
  TeacherIcon,
} from "@hugeicons/core-free-icons";

export const roles = [
  { value: "teacher", icon: TeacherIcon },
  { value: "student", icon: StudentIcon },
  { value: "parent", icon: ChildIcon },
] as const;
