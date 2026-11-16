import {
  Analytics01Icon,
  Calendar03Icon,
  Certificate01Icon,
  LibraryIcon,
  MessageMultiple01Icon,
  StudentIcon,
  Task01Icon,
  TaskEdit01Icon,
  UserLove01Icon,
} from "@hugeicons/core-free-icons";

/**
 * What Nakafa School gives a school, in the order its landing shows it: one
 * part of the page each. A key is the id of its part, the hash the header
 * links to, and the name of its words; an icon is the one the School app draws
 * for that page.
 */
export const SCHOOL_FEATURES = [
  { icon: MessageMultiple01Icon, key: "forum" },
  { icon: LibraryIcon, key: "library" },
  { icon: Task01Icon, key: "tasks" },
  { icon: TaskEdit01Icon, key: "exams" },
  { icon: StudentIcon, key: "player" },
  { icon: Certificate01Icon, key: "reports" },
  { icon: Analytics01Icon, key: "insight" },
  { icon: UserLove01Icon, key: "parents" },
  { icon: Calendar03Icon, key: "year" },
] as const;

/** The key of one part of the School landing. */
export type SchoolFeature = (typeof SCHOOL_FEATURES)[number]["key"];
