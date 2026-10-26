import type { BuiltinRole } from "@repo/backend/confect/access/schema";
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cva } from "class-variance-authority";
import { useTranslations } from "use-intl";
import { roleLooks } from "@/components/tenant/roles";

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
