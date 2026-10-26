import {
  Chatting01Icon,
  Crown02Icon,
  DocumentValidationIcon,
  Plug01Icon,
  School01Icon,
  StudentIcon,
  TeacherIcon,
  UserGroupIcon,
  UserLove01Icon,
  UserSettings01Icon,
  UserStar01Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import type { BuiltinRole } from "@repo/backend/confect/access/schema";
import type { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { ComponentProps } from "react";

/** Each built-in role's family and icon. A role added without them does not compile. */
export const roleLooks = {
  admin: { family: "lead", icon: UserSettings01Icon },
  auditor: { family: "run", icon: DocumentValidationIcon },
  counselor: { family: "teach", icon: Chatting01Icon },
  deputy: { family: "lead", icon: UserStar01Icon },
  guardian: { family: "care", icon: UserLove01Icon },
  integration: { family: "run", icon: Plug01Icon },
  owner: { family: "lead", icon: Crown02Icon },
  principal: { family: "lead", icon: School01Icon },
  proctor: { family: "teach", icon: ViewIcon },
  staff: { family: "run", icon: UserGroupIcon },
  student: { family: "learn", icon: StudentIcon },
  teacher: { family: "teach", icon: TeacherIcon },
} satisfies Record<
  BuiltinRole,
  {
    family: "care" | "lead" | "learn" | "run" | "teach";
    icon: ComponentProps<typeof HugeIcons>["icon"];
  }
>;

/** The icon of a built-in role, the same as its badge's. */
export function roleIcon(role: BuiltinRole) {
  return roleLooks[role].icon;
}
