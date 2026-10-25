import {
  Dashboard,
  type DashboardTone,
} from "@repo/design-system/components/ui/dashboard";
import type { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { ComponentProps } from "react";
import { useTenant } from "@/components/tenant/context";
import type { CellSpan } from "@/components/tenant/home/cells";
import { TargetLink } from "@/lib/routing/link";
import { schoolExamsTarget } from "@/lib/routing/school/target";

/**
 * One number of the strip at the top of a staff home, as a cell that links to the exams list, where the rooms, results
 * and drafts it counts live. Its number is a count, which the caller builds, and its span is one of the four shares
 * of the strip. Its icon and tone are the ones of the cell that lists what it counts, so the two read as one.
 */
export function MetricCell({
  count,
  icon,
  period,
  span,
  title,
  tone,
}: {
  count: string;
  icon: ComponentProps<typeof HugeIcons>["icon"];
  period: string;
  span: CellSpan;
  title: string;
  tone: typeof DashboardTone.Type;
}) {
  const { slug } = useTenant();

  return (
    <Dashboard.Cell
      narrow={span.narrow}
      render={<TargetLink target={schoolExamsTarget(slug)} />}
      wide={span.wide}
    >
      <Dashboard.CellHeader icon={icon} title={title} tone={tone} />
      <Dashboard.Value>{count}</Dashboard.Value>
      <Dashboard.Period>{period}</Dashboard.Period>
    </Dashboard.Cell>
  );
}
