import { Dashboard } from "@repo/design-system/components/ui/dashboard";
import { useTenant } from "@/components/tenant/context";
import type { CellSpan } from "@/components/tenant/home/cells";
import { TargetLink } from "@/lib/routing/link";
import { schoolExamsTarget } from "@/lib/routing/school/target";

/**
 * One number of the row at the top of a staff home, as a card that links to the exams list, where the rooms, results
 * and drafts it counts live. Its number is a count, which the caller builds, and its span is one of the four shares
 * of the row. Its title names what it counts in plain words, as the card that lists those things does.
 */
export function MetricCell({
  count,
  period,
  span,
  title,
}: {
  count: string;
  period: string;
  span: CellSpan;
  title: string;
}) {
  const { slug } = useTenant();

  return (
    <Dashboard.Cell
      narrow={span.narrow}
      render={<TargetLink target={schoolExamsTarget(slug)} />}
      wide={span.wide}
    >
      <Dashboard.CellHeader title={title} />
      <Dashboard.Value>{count}</Dashboard.Value>
      <Dashboard.Period>{period}</Dashboard.Period>
    </Dashboard.Cell>
  );
}
