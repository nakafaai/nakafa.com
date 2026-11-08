import {
  Analytics01Icon,
  Certificate01Icon,
  LibraryIcon,
  MessageMultiple01Icon,
  MortarboardIcon,
  Task01Icon,
  TaskEdit01Icon,
  UserLove01Icon,
} from "@hugeicons/core-free-icons";

/**
 * What Nakafa School gives a school, in the order its landing shows them. Each
 * key is the id of the landing's section and the hash the header links to, and
 * each icon is the one the School app draws for that page.
 */
export const SCHOOL_FEATURES = [
  { icon: MessageMultiple01Icon, key: "forum" },
  { icon: LibraryIcon, key: "library" },
  { icon: Task01Icon, key: "tasks" },
  { icon: TaskEdit01Icon, key: "exams" },
  { icon: Certificate01Icon, key: "reports" },
  { icon: Analytics01Icon, key: "insight" },
  { icon: MortarboardIcon, key: "graduation" },
  { icon: UserLove01Icon, key: "parents" },
] as const;
