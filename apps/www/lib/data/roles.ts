import {
  GraduationCapIcon,
  SchoolIcon,
  SpeechIcon,
  UsersIcon,
} from "lucide-react";

export const roles = [
  { value: "teacher", icon: SpeechIcon },
  { value: "student", icon: GraduationCapIcon },
  { value: "parent", icon: UsersIcon },
  { value: "admin", icon: SchoolIcon },
] as const;
