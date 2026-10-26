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
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cva } from "class-variance-authority";
import type { ComponentProps } from "react";
import { useTranslations } from "use-intl";

/**
 * A role's badge takes its family's color from the theme's chart colors, so the roles that
 * lead, teach, learn, care and run the school read apart at a glance in every theme.
 */
const roleBadgeVariants = cva(
  "gap-1.5 border-transparent text-foreground [&_svg]:size-3.5",
  {
    variants: {
      family: {
        care: "bg-chart-3/12 [&_svg]:text-chart-3",
        lead: "bg-chart-1/12 [&_svg]:text-chart-1",
        learn: "bg-chart-4/15 [&_svg]:text-chart-4",
        run: "bg-chart-5/12 [&_svg]:text-chart-5",
        teach: "bg-chart-2/12 [&_svg]:text-chart-2",
      },
    },
  }
);

/** Each built-in role's family and icon. A role added without them does not compile. */
const roleLooks = {
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

/** A built-in role as a badge: its icon and its name, in its family's color. */
export function RoleBadge({ role }: { role: BuiltinRole }) {
  const tSchool = useTranslations("School");
  const look = roleLooks[role];

  return (
    <Badge
      className={roleBadgeVariants({ family: look.family })}
      variant="outline"
    >
      <HugeIcons icon={look.icon} />
      {tSchool(`role.${role}`)}
    </Badge>
  );
}
